import { createServerFn } from "@tanstack/react-start";

function addressOf(input: unknown) {
  if (!input || typeof input !== "object" || !("address" in input)) {
    throw new Error("Enter a Solana address.");
  }
  const address = (input as { address?: unknown }).address;
  if (typeof address !== "string" || !/^[1-9A-HJ-NP-Za-km-z]{32,44}$/.test(address)) {
    throw new Error("Enter a valid Solana address.");
  }
  return address;
}

export const getMarketScan = createServerFn({ method: "GET" })
  .validator((input: unknown) => {
    const force =
      !!input && typeof input === "object" && "force" in input
        ? Boolean((input as { force?: boolean }).force)
        : false;
    return { force };
  })
  .handler(async ({ data }) => {
    const { loadScan } = await import("@/lib/server/market.server");
    return loadScan(data.force);
  });

export const getTokenDetail = createServerFn({ method: "GET" })
  .validator((input: unknown) => {
    const mint = input && typeof input === "object" && "mint" in input ? (input as { mint?: unknown }).mint : "";
    if (typeof mint !== "string" || !/^[1-9A-HJ-NP-Za-km-z]{32,44}$/.test(mint)) {
      throw new Error("Enter a valid mint address.");
    }
    return { mint };
  })
  .handler(async ({ data }) => {
    const { loadToken } = await import("@/lib/server/market.server");
    return loadToken(data.mint);
  });

export const getPortfolio = createServerFn({ method: "GET" })
  .validator((input: unknown) => ({ address: addressOf(input) }))
  .handler(async ({ data }) => {
    const { loadPortfolio } = await import("@/lib/server/chain.server");
    return loadPortfolio(data.address);
  });

export const getHistory = createServerFn({ method: "GET" })
  .validator((input: unknown) => ({ address: addressOf(input) }))
  .handler(async ({ data }) => {
    const { loadHistory } = await import("@/lib/server/chain.server");
    return loadHistory(data.address);
  });

export const getNetwork = createServerFn({ method: "GET" })
  .handler(async () => {
    const { loadNetwork } = await import("@/lib/server/chain.server");
    return loadNetwork();
  });

export const inspectMintFn = createServerFn({ method: "GET" })
  .validator((input: unknown) => {
    const mint = input && typeof input === "object" && "mint" in input ? (input as { mint?: unknown }).mint : "";
    if (typeof mint !== "string" || !/^[1-9A-HJ-NP-Za-km-z]{32,44}$/.test(mint)) {
      throw new Error("Enter a valid mint address.");
    }
    return { mint };
  })
  .handler(async ({ data }) => {
    const { inspectMint } = await import("@/lib/server/chain.server");
    return inspectMint(data.mint);
  });

export const prepareSendFn = createServerFn({ method: "POST" })
  .validator((input: unknown) => {
    if (!input || typeof input !== "object") throw new Error("Missing transfer details.");
    const row = input as { from?: unknown; to?: unknown; asset?: unknown; amount?: unknown; symbol?: unknown };
    const check = (value: unknown, label: string) => {
      if (typeof value !== "string" || !/^[1-9A-HJ-NP-Za-km-z]{32,44}$/.test(value)) {
        throw new Error(`Enter a valid Solana ${label}.`);
      }
      return value;
    };
    const asset = row.asset === "native" ? "native" : check(row.asset, "mint");
    if (typeof row.amount !== "string" || row.amount.length > 40) throw new Error("Enter an amount.");
    return {
      from: check(row.from, "sender"),
      to: check(row.to, "recipient"),
      asset,
      amount: row.amount,
      symbol: typeof row.symbol === "string" ? row.symbol.slice(0, 16) : "asset",
    };
  })
  .handler(async ({ data }) => {
    const { prepareSend } = await import("@/lib/server/chain.server");
    return prepareSend(data);
  });
