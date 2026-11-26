import {
  Connection,
  PublicKey,
  SystemProgram,
  TransactionMessage,
  VersionedTransaction,
} from "@solana/web3.js";
import {
  ExtensionType,
  TOKEN_2022_PROGRAM_ID,
  createAssociatedTokenAccountInstruction,
  createTransferCheckedInstruction,
  getAssociatedTokenAddressSync,
  getExtensionTypes,
  unpackMint,
} from "@solana/spl-token";
import type {
  HistoryRow,
  HistoryTokenDelta,
  MintInspect,
  NetworkStatus,
  Portfolio,
  PortfolioToken,
  PrepareResult,
} from "@/lib/chain/types";
import { BASE_FEE_LAMPORTS, NATIVE_SOL, SPL_PROGRAM, TOKEN_2022 } from "@/lib/constants";
import { formatUnits, parseUiAmount } from "@/lib/format";
import { jupPrices, jupSearch } from "@/lib/server/jupiter.server";

const RPCS = ["https://api.mainnet-beta.solana.com", "https://solana-rpc.publicnode.com"];

async function withRpc<T>(fn: (connection: Connection) => Promise<T>): Promise<T> {
  let last = "Solana network data is temporarily unavailable.";
  for (const url of RPCS) {
    try {
      return await fn(new Connection(url, "confirmed"));
    } catch (error) {
      const message = error instanceof Error ? error.message : "";
      if (message.startsWith("Enter ") || message.startsWith("That ") || message.startsWith("Amount") || message.startsWith("Recipient") || message.startsWith("You need") || message.startsWith("Mint ") || message.startsWith("Simulation") || message.startsWith("This asset")) {
        throw error;
      }
      last = /429|rate|busy/i.test(message)
        ? "The public Solana RPC is busy. Try again in a moment."
        : "Solana network data is temporarily unavailable.";
    }
  }
  throw new Error(last);
}

function pubkey(value: string, label: string) {
  try {
    return new PublicKey(value);
  } catch {
    throw new Error(`Enter a valid Solana ${label}.`);
  }
}

type TokenAmount = { amount?: string; decimals?: number; uiAmountString?: string };
type ParsedInfo = { mint?: string; tokenAmount?: TokenAmount };

function readParsed(account: { data: unknown }): ParsedInfo | null {
  const data = account.data as { parsed?: { info?: ParsedInfo } };
  return data.parsed?.info ?? null;
}

export async function loadPortfolio(address: string): Promise<Portfolio> {
  const owner = pubkey(address, "address");
  const fetchedAt = new Date().toISOString();
  const chain = await withRpc(async (connection) => {
    const [lamports, classic, token2022] = await Promise.all([
      connection.getBalance(owner),
      connection.getParsedTokenAccountsByOwner(owner, { programId: new PublicKey(SPL_PROGRAM) }),
      connection.getParsedTokenAccountsByOwner(owner, { programId: new PublicKey(TOKEN_2022) }),
    ]);
    const rows: Array<{ mint: string; amount: bigint; decimals: number; ui: string; program: PortfolioToken["program"] }> = [];
    const push = (
      accounts: typeof classic.value,
      program: PortfolioToken["program"],
    ) => {
      for (const account of accounts) {
        const info = readParsed(account.account);
        const mint = info?.mint;
        const raw = info?.tokenAmount?.amount;
        if (!mint || !raw) continue;
        const amount = BigInt(raw);
        if (amount <= 0n) continue;
        rows.push({
          mint,
          amount,
          decimals: info.tokenAmount?.decimals ?? 0,
          ui: info.tokenAmount?.uiAmountString || formatUnits(amount, info.tokenAmount?.decimals ?? 0),
          program,
        });
      }
    };
    push(classic.value, "spl");
    push(token2022.value, "token-2022");
    return { lamports, rows };
  });

  const truncated = chain.rows.length > 100;
  const rows = chain.rows.slice(0, 100);
  let partialPrices = false;
  let prices: Record<string, { usdPrice?: number }> = {};
  let meta = new Map<string, { symbol?: string; name?: string; icon?: string | null; decimals?: number }>();
  try {
    prices = await jupPrices([NATIVE_SOL, ...rows.map((row) => row.mint)]);
  } catch {
    partialPrices = true;
  }
  try {
    const found = await jupSearch(rows.map((row) => row.mint));
    meta = new Map(found.map((token) => [token.id, token]));
  } catch {
    partialPrices = true;
  }

  const solPrice = prices[NATIVE_SOL]?.usdPrice;
  const solUsd = typeof solPrice === "number" ? (chain.lamports / 1e9) * solPrice : null;
  const tokens: PortfolioToken[] = rows
    .map((row) => {
      const info = meta.get(row.mint);
      const price = prices[row.mint]?.usdPrice;
      const ui = Number(row.ui);
      return {
        mint: row.mint,
        symbol: info?.symbol || row.mint.slice(0, 4),
        name: info?.name || "SPL token",
        icon: info?.icon ?? null,
        decimals: row.decimals,
        amountRaw: row.amount.toString(),
        uiAmount: row.ui,
        usd: typeof price === "number" && Number.isFinite(ui) ? ui * price : null,
        program: row.program,
      };
    })
    .sort((a, b) => (b.usd ?? -1) - (a.usd ?? -1));

  const tokenUsd = tokens.reduce((sum, token) => sum + (token.usd ?? 0), 0);
  const priced = tokens.some((token) => token.usd != null) || solUsd != null;
  return {
    address,
    solLamports: String(chain.lamports),
    solUi: formatUnits(BigInt(chain.lamports), 9),
    solUsd,
    solPrice: typeof solPrice === "number" ? solPrice : null,
    tokens,
    totalUsd: priced ? (solUsd ?? 0) + tokenUsd : null,
    fetchedAt,
    partialPrices,
    truncated,
  };
}

type LooseBal = {
  owner?: string;
  mint?: string;
  uiTokenAmount?: { amount?: string; decimals?: number };
};

type LooseTx = {
  blockTime?: number | null;
  meta?: {
    err: unknown;
    fee?: number;
    preBalances?: number[];
    postBalances?: number[];
    preTokenBalances?: LooseBal[] | null;
    postTokenBalances?: LooseBal[] | null;
  } | null;
  transaction?: {
    message?: {
      accountKeys?: Array<{ pubkey?: { toBase58(): string } } | string>;
      instructions?: Array<{ parsed?: { type?: string } | string }>;
    };
  };
};

function keyOf(key: { pubkey?: { toBase58(): string } } | string) {
  if (typeof key === "string") return key;
  return key.pubkey?.toBase58() ?? "";
}

function balanceMap(list: LooseBal[] | null | undefined, owner: string) {
  const map = new Map<string, { amount: bigint; decimals: number }>();
  for (const row of list ?? []) {
    if (row.owner !== owner || !row.mint) continue;
    const amount = BigInt(row.uiTokenAmount?.amount ?? "0");
    const prev = map.get(row.mint);
    map.set(row.mint, {
      amount: (prev?.amount ?? 0n) + amount,
      decimals: row.uiTokenAmount?.decimals ?? prev?.decimals ?? 0,
    });
  }
  return map;
}

function parseHistory(owner: string, signature: string, slot: number, blockTime: number | null, err: unknown, tx: LooseTx | null): HistoryRow {
  if (!tx?.meta) {
    return {
      signature,
      slot,
      time: blockTime,
      err: err ? "failed" : null,
      feeLamports: 0,
      solDelta: null,
      tokens: [],
      label: err ? "Failed" : "Transaction",
    };
  }
  const keys = (tx.transaction?.message?.accountKeys ?? []).map(keyOf);
  const index = keys.indexOf(owner);
  let solDelta: number | null = null;
  if (index >= 0) {
    const pre = tx.meta.preBalances?.[index] ?? 0;
    const post = tx.meta.postBalances?.[index] ?? 0;
    solDelta = (post - pre) / 1e9;
  }
  const pre = balanceMap(tx.meta.preTokenBalances, owner);
  const post = balanceMap(tx.meta.postTokenBalances, owner);
  const mints = new Set([...pre.keys(), ...post.keys()]);
  const tokens: HistoryTokenDelta[] = [];
  for (const mint of mints) {
    const before = pre.get(mint)?.amount ?? 0n;
    const after = post.get(mint)?.amount ?? 0n;
    const delta = after - before;
    if (delta === 0n) continue;
    const decimals = post.get(mint)?.decimals ?? pre.get(mint)?.decimals ?? 0;
    tokens.push({
      mint,
      deltaRaw: delta.toString(),
      decimals,
      ui: formatUnits(delta, decimals),
    });
  }
  const types = new Set<string>();
  for (const instruction of tx.transaction?.message?.instructions ?? []) {
    if (instruction.parsed && typeof instruction.parsed === "object" && instruction.parsed.type) {
      types.add(instruction.parsed.type);
    }
  }
  let label = "Transaction";
  if (tx.meta.err) label = "Failed";
  else if (types.has("swap") || (tokens.length >= 2 && (solDelta ?? 0) !== 0)) label = "Swap";
  else if (tokens.length === 1) label = tokens[0].ui.startsWith("-") ? "Sent token" : "Received token";
  else if ((solDelta ?? 0) < -0.00001) label = "Sent SOL";
  else if ((solDelta ?? 0) > 0.00001) label = "Received SOL";
  return {
    signature,
    slot,
    time: tx.blockTime ?? blockTime,
    err: tx.meta.err ? "failed" : null,
    feeLamports: tx.meta.fee ?? 0,
    solDelta,
    tokens: tokens.slice(0, 6),
    label,
  };
}

export async function loadHistory(address: string): Promise<HistoryRow[]> {
  const owner = pubkey(address, "address");
  return withRpc(async (connection) => {
    const signatures = await connection.getSignaturesForAddress(owner, { limit: 15 });
    const rows = await Promise.all(
      signatures.map(async (item) => {
        try {
          const tx = await connection.getParsedTransaction(item.signature, {
            maxSupportedTransactionVersion: 0,
          });
          return parseHistory(address, item.signature, item.slot, item.blockTime ?? null, item.err, tx as LooseTx | null);
        } catch {
          return parseHistory(address, item.signature, item.slot, item.blockTime ?? null, item.err, null);
        }
      }),
    );
    return rows;
  });
}

export async function loadNetwork(): Promise<NetworkStatus> {
  return withRpc(async (connection) => {
    const [epoch, blockhash, samples] = await Promise.all([
      connection.getEpochInfo("confirmed"),
      connection.getLatestBlockhash("confirmed"),
      connection.getRecentPerformanceSamples(3),
    ]);
    let health: NetworkStatus["health"] = "ok";
    try {
      const response = await fetch(connection.rpcEndpoint, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ jsonrpc: "2.0", id: 1, method: "getHealth" }),
        signal: AbortSignal.timeout(8_000),
      });
      const body = (await response.json()) as { result?: string };
      if (body.result !== "ok") health = "degraded";
    } catch {
      health = "degraded";
    }
    const sample = samples[0];
    const tps = sample ? sample.numTransactions / sample.samplePeriodSecs : 0;
    return {
      health,
      slot: epoch.absoluteSlot,
      epoch: epoch.epoch,
      epochProgress: epoch.slotsInEpoch ? epoch.slotIndex / epoch.slotsInEpoch : 0,
      tps,
      blockhash: blockhash.blockhash,
      baseFeeLamports: BASE_FEE_LAMPORTS,
      fetchedAt: new Date().toISOString(),
      cluster: "mainnet-beta",
    };
  });
}

function extensionNames(types: ExtensionType[]) {
  return types.map((type) => ExtensionType[type] ?? `extension-${type}`);
}

export async function inspectMint(mintAddress: string): Promise<MintInspect> {
  const mint = pubkey(mintAddress, "mint");
  return withRpc(async (connection) => {
    const info = await connection.getAccountInfo(mint);
    if (!info) {
      return {
        mint: mintAddress,
        exists: false,
        program: null,
        decimals: null,
        supplyUi: null,
        mintAuthority: null,
        freezeAuthority: null,
        confidential: false,
        extensions: [],
        deposit: "unsupported",
        withdraw: "unsupported",
        reason: "No account exists at this address on Solana mainnet.",
      };
    }
    const owner = info.owner.toBase58();
    const program = owner === TOKEN_2022 ? "token-2022" : owner === SPL_PROGRAM ? "spl" : "other";
    if (program === "other") {
      return {
        mint: mintAddress,
        exists: true,
        program,
        decimals: null,
        supplyUi: null,
        mintAuthority: null,
        freezeAuthority: null,
        confidential: false,
        extensions: [],
        deposit: "unsupported",
        withdraw: "unsupported",
        reason: "This account is not an SPL or Token-2022 mint, so ZK Rail cannot shield it.",
      };
    }
    try {
      const state = unpackMint(mint, info, info.owner);
      const extensions = program === "token-2022" ? extensionNames(getExtensionTypes(state.tlvData)) : [];
      const confidential = program === "token-2022" && getExtensionTypes(state.tlvData).includes(ExtensionType.ConfidentialTransferMint);
      const supplyUi = formatUnits(state.supply, state.decimals);
      if (!confidential) {
        return {
          mint: mintAddress,
          exists: true,
          program,
          decimals: state.decimals,
          supplyUi,
          mintAuthority: state.mintAuthority?.toBase58() ?? null,
          freezeAuthority: state.freezeAuthority?.toBase58() ?? null,
          confidential: false,
          extensions,
          deposit: "unsupported",
          withdraw: "unsupported",
          reason:
            program === "spl"
              ? "Classic SPL mints have no confidential-transfer extension. A send from Private Wallet is public."
              : "This Token-2022 mint has not enabled confidential transfers. Deposit and withdraw stay off.",
        };
      }
      return {
        mint: mintAddress,
        exists: true,
        program,
        decimals: state.decimals,
        supplyUi,
        mintAuthority: state.mintAuthority?.toBase58() ?? null,
        freezeAuthority: state.freezeAuthority?.toBase58() ?? null,
        confidential: true,
        extensions,
        deposit: "wallet-proof",
        withdraw: "wallet-proof",
        reason:
          "Confidential transfers are enabled on this mint. The zero-knowledge proof has to come from your wallet. FlowSend will not generate or store a decryption key, so the deposit and withdraw are not broadcast from this app.",
      };
    } catch {
      return {
        mint: mintAddress,
        exists: true,
        program,
        decimals: null,
        supplyUi: null,
        mintAuthority: null,
        freezeAuthority: null,
        confidential: false,
        extensions: [],
        deposit: "unsupported",
        withdraw: "unsupported",
        reason: "The mint account could not be parsed. Nothing was sent.",
      };
    }
  });
}

function simMessage(err: unknown) {
  try {
    const text = JSON.stringify(err);
    if (!text || text === "null") return "The network rejected this transaction in simulation.";
    if (text.length > 160) return "Simulation failed. Check the amount, the recipient, and the SOL left for fees.";
    return `Simulation failed: ${text}`;
  } catch {
    return "Simulation failed.";
  }
}

export async function prepareSend(input: {
  from: string;
  to: string;
  asset: string;
  amount: string;
  symbol: string;
}): Promise<PrepareResult> {
  const from = pubkey(input.from, "sender");
  const to = pubkey(input.to, "recipient");
  if (from.equals(to)) throw new Error("Recipient must be a different address.");
  const symbol = input.symbol.trim().slice(0, 16) || "asset";

  return withRpc(async (connection) => {
    const { blockhash } = await connection.getLatestBlockhash("confirmed");
    const instructions = [];
    let ataRentLamports = 0;
    let decimals = 9;
    let amountRaw = 0n;

    if (input.asset === "native") {
      decimals = 9;
      amountRaw = parseUiAmount(input.amount, 9);
      const balance = BigInt(await connection.getBalance(from));
      const fee = BigInt(BASE_FEE_LAMPORTS);
      if (amountRaw + fee > balance) {
        throw new Error("Amount plus the base network fee exceeds your SOL balance.");
      }
      const rent = BigInt(await connection.getMinimumBalanceForRentExemption(0));
      const remain = balance - amountRaw - fee;
      if (remain !== 0n && remain < rent) {
        throw new Error("That would leave the account below Solana's rent minimum. Send less, or sweep the available balance.");
      }
      instructions.push(
        SystemProgram.transfer({
          fromPubkey: from,
          toPubkey: to,
          lamports: amountRaw,
        }),
      );
    } else {
      const mint = pubkey(input.asset, "mint");
      const info = await connection.getAccountInfo(mint);
      if (!info) throw new Error("Mint account was not found on mainnet.");
      const programId = info.owner;
      if (!programId.equals(new PublicKey(SPL_PROGRAM)) && !programId.equals(TOKEN_2022_PROGRAM_ID)) {
        throw new Error("Mint account was not found on mainnet.");
      }
      const state = unpackMint(mint, info, programId);
      decimals = state.decimals;
      amountRaw = parseUiAmount(input.amount, decimals);
      const held = await connection.getParsedTokenAccountsByOwner(from, { mint });
      let source: PublicKey | null = null;
      let sourceAmount = 0n;
      const preferred = getAssociatedTokenAddressSync(mint, from, false, programId);
      for (const account of held.value) {
        const parsed = readParsed(account.account);
        const raw = BigInt(parsed?.tokenAmount?.amount ?? "0");
        if (account.pubkey.equals(preferred) && raw > sourceAmount) {
          source = account.pubkey;
          sourceAmount = raw;
        } else if (!source && raw >= amountRaw) {
          source = account.pubkey;
          sourceAmount = raw;
        }
      }
      if (!source || sourceAmount < amountRaw) {
        throw new Error("Amount exceeds your token balance.");
      }
      const destination = getAssociatedTokenAddressSync(mint, to, false, programId);
      const destInfo = await connection.getAccountInfo(destination);
      if (!destInfo) {
        instructions.push(
          createAssociatedTokenAccountInstruction(from, destination, to, mint, programId),
        );
        const size = programId.equals(TOKEN_2022_PROGRAM_ID) ? 182 : 165;
        ataRentLamports = await connection.getMinimumBalanceForRentExemption(size);
      }
      const sol = BigInt(await connection.getBalance(from));
      const needed = BigInt(BASE_FEE_LAMPORTS + ataRentLamports);
      if (sol < needed) {
        throw new Error(
          destInfo
            ? "You need a little SOL to pay the network fee."
            : "You need SOL for the network fee and the recipient's token account.",
        );
      }
      instructions.push(
        createTransferCheckedInstruction(
          source,
          mint,
          destination,
          from,
          amountRaw,
          decimals,
          [],
          programId,
        ),
      );
    }

    const message = new TransactionMessage({
      payerKey: from,
      recentBlockhash: blockhash,
      instructions,
    }).compileToV0Message();
    const transaction = new VersionedTransaction(message);
    const simulation = await connection.simulateTransaction(transaction, {
      sigVerify: false,
      replaceRecentBlockhash: true,
    });
    if (simulation.value.err) throw new Error(simMessage(simulation.value.err));

    return {
      txBase64: Buffer.from(transaction.serialize()).toString("base64"),
      networkFeeLamports: BASE_FEE_LAMPORTS,
      ataRentLamports,
      summary: `Send ${input.amount} ${symbol}`,
      decimals,
      amountRaw: amountRaw.toString(),
      symbol,
    };
  });
}
