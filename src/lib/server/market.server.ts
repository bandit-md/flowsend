import { MAJORS, NATIVE_SOL } from "@/lib/constants";
import { assess } from "@/lib/market/score";
import type { JupToken, MarketScan, ScanToken, TokenDetail } from "@/lib/market/types";
import { jupGet, jupSearch } from "@/lib/server/jupiter.server";

type DexPair = {
  dexId?: string;
  url?: string;
  baseToken?: { address?: string; name?: string; symbol?: string };
  priceUsd?: string;
  volume?: { h24?: number };
  priceChange?: { h24?: number; h6?: number; h1?: number; m5?: number };
  liquidity?: { usd?: number };
  fdv?: number;
  marketCap?: number;
  pairCreatedAt?: number;
  txns?: { h24?: { buys?: number; sells?: number } };
};

type DexProfile = { chainId?: string; tokenAddress?: string };

const TTL = 75_000;
let cache: { at: number; data: MarketScan } | null = null;

function num(value: unknown): number | null {
  return typeof value === "number" && Number.isFinite(value) ? value : null;
}

function asTokens(data: unknown): JupToken[] {
  if (!Array.isArray(data)) return [];
  return data.filter(
    (row): row is JupToken =>
      !!row && typeof row === "object" && typeof (row as JupToken).id === "string",
  );
}

async function dexGet(path: string): Promise<unknown> {
  const response = await fetch(`https://api.dexscreener.com${path}`, {
    headers: { accept: "application/json" },
    signal: AbortSignal.timeout(12_000),
  });
  if (!response.ok) throw new Error(`DEX Screener responded ${response.status}.`);
  return response.json();
}

function finish(
  draft: Omit<ScanToken, "risk" | "riskLevel" | "screenScore">,
): ScanToken {
  return { ...draft, ...assess(draft) };
}

function fromJup(
  token: JupToken,
  extra?: { boosted?: boolean; dex?: string | null; dexUrl?: string | null },
): ScanToken {
  const buy = num(token.stats24h?.buyVolume);
  const sell = num(token.stats24h?.sellVolume);
  const volume = buy != null || sell != null ? (buy ?? 0) + (sell ?? 0) : null;
  return finish({
    mint: token.id,
    name: token.name?.trim() || "Unknown token",
    symbol: token.symbol?.trim() || "?",
    icon: token.icon ?? null,
    decimals: token.decimals ?? 0,
    priceUsd: num(token.usdPrice),
    mcap: num(token.mcap),
    fdv: num(token.fdv),
    liquidity: num(token.liquidity),
    holders: num(token.holderCount),
    organicScore: num(token.organicScore),
    organicLabel: token.organicScoreLabel ?? null,
    verified: Boolean(token.isVerified),
    tags: Array.isArray(token.tags) ? token.tags.filter((tag) => typeof tag === "string") : [],
    tokenProgram: token.tokenProgram ?? null,
    poolCreatedAt: token.firstPool?.createdAt ?? null,
    change5m: num(token.stats5m?.priceChange),
    change1h: num(token.stats1h?.priceChange),
    change6h: num(token.stats6h?.priceChange),
    change24h: num(token.stats24h?.priceChange),
    volume24h: volume,
    buyVolume24h: buy,
    sellVolume24h: sell,
    netFlow24h: buy != null || sell != null ? (buy ?? 0) - (sell ?? 0) : null,
    traders24h: num(token.stats24h?.numTraders),
    topHoldersPct: num(token.audit?.topHoldersPercentage),
    mintAuthorityDisabled: token.audit?.mintAuthorityDisabled ?? null,
    freezeAuthorityDisabled: token.audit?.freezeAuthorityDisabled ?? null,
    boosted: extra?.boosted ?? false,
    dex: extra?.dex ?? null,
    dexscreenerUrl: extra?.dexUrl || `https://dexscreener.com/solana/${token.id}`,
    sources: ["jupiter"],
  });
}

function fromDex(pair: DexPair, boosted: boolean): ScanToken | null {
  const mint = pair.baseToken?.address;
  if (!mint || mint === NATIVE_SOL) return null;
  const price = pair.priceUsd != null ? Number(pair.priceUsd) : null;
  return finish({
    mint,
    name: pair.baseToken?.name || "Unknown token",
    symbol: pair.baseToken?.symbol || "?",
    icon: null,
    decimals: 0,
    priceUsd: price != null && Number.isFinite(price) ? price : null,
    mcap: num(pair.marketCap),
    fdv: num(pair.fdv),
    liquidity: num(pair.liquidity?.usd),
    holders: null,
    organicScore: null,
    organicLabel: null,
    verified: false,
    tags: [],
    tokenProgram: null,
    poolCreatedAt: pair.pairCreatedAt ? new Date(pair.pairCreatedAt).toISOString() : null,
    change5m: num(pair.priceChange?.m5),
    change1h: num(pair.priceChange?.h1),
    change6h: num(pair.priceChange?.h6),
    change24h: num(pair.priceChange?.h24),
    volume24h: num(pair.volume?.h24),
    buyVolume24h: null,
    sellVolume24h: null,
    netFlow24h: null,
    traders24h: null,
    topHoldersPct: null,
    mintAuthorityDisabled: null,
    freezeAuthorityDisabled: null,
    boosted,
    dex: pair.dexId ?? null,
    dexscreenerUrl: pair.url || `https://dexscreener.com/solana/${mint}`,
    sources: ["dexscreener"],
  });
}

function isStable(token: ScanToken) {
  if (token.tags.some((tag) => tag.toLowerCase().includes("stable"))) return true;
  const symbol = token.symbol.replace(/[^a-z0-9]/gi, "").toLowerCase();
  return ["usdc", "usdt", "usd1", "usds", "pyusd", "eurc", "usde", "fdusd", "usdg"].includes(symbol);
}

function bestPairs(pairs: DexPair[]) {
  const map = new Map<string, DexPair>();
  for (const pair of pairs) {
    const mint = pair.baseToken?.address;
    if (!mint) continue;
    const current = map.get(mint);
    const liquidity = pair.liquidity?.usd ?? 0;
    if (!current || liquidity > (current.liquidity?.usd ?? 0)) map.set(mint, pair);
  }
  return map;
}

function solanaMints(rows: unknown): string[] {
  if (!Array.isArray(rows)) return [];
  return rows
    .filter((row): row is DexProfile => !!row && typeof row === "object")
    .filter((row) => row.chainId === "solana" && typeof row.tokenAddress === "string")
    .map((row) => row.tokenAddress as string);
}

async function compute(): Promise<MarketScan> {
  const notes: string[] = [];
  const now = new Date();
  const empty = (): MarketScan => ({
    ok: false,
    message: "Market data is unavailable right now.",
    scannedAt: now.toISOString(),
    dayKey: now.toISOString().slice(0, 10),
    solPrice: null,
    solChange24h: null,
    sources: { jupiter: false, dexscreener: false, notes },
    trending: [],
    traded: [],
    launches: [],
    ranked: [],
    concentration: [],
    flow: [],
  });

  const [trendingRes, organicRes, tradedRes, recentRes, priceRes, boostRes, profileRes] =
    await Promise.all([
      jupGet<unknown>("/tokens/v2/toptrending/24h?limit=40").catch(() => {
        notes.push("Jupiter trending did not respond.");
        return null;
      }),
      jupGet<unknown>("/tokens/v2/toporganicscore/24h?limit=30").catch(() => {
        notes.push("Jupiter organic scores did not respond.");
        return null;
      }),
      jupGet<unknown>("/tokens/v2/toptraded/24h?limit=30").catch(() => {
        notes.push("Jupiter traded list did not respond.");
        return null;
      }),
      jupGet<unknown>("/tokens/v2/recent").catch(() => {
        notes.push("Jupiter new pools did not respond.");
        return null;
      }),
      jupGet<Record<string, { usdPrice?: number; priceChange24h?: number }>>(
        `/price/v3?ids=${NATIVE_SOL}`,
      ).catch(() => null),
      dexGet("/token-boosts/top/v1").catch(() => {
        notes.push("DEX Screener boosts did not respond.");
        return null;
      }),
      dexGet("/token-profiles/latest/v1").catch(() => {
        notes.push("DEX Screener profiles did not respond.");
        return null;
      }),
    ]);

  const jupiterOk = [trendingRes, organicRes, tradedRes, recentRes].some(Boolean);
  const dexOk = Boolean(boostRes || profileRes);
  if (!jupiterOk && !dexOk) {
    const failed = empty();
    failed.message = "Jupiter and DEX Screener both failed. Nothing was invented in their place.";
    return failed;
  }

  const byMint = new Map<string, JupToken>();
  const remember = (list: JupToken[]) => {
    for (const token of list) {
      if (!byMint.has(token.id)) byMint.set(token.id, token);
    }
  };
  const trending = asTokens(trendingRes);
  const organic = asTokens(organicRes);
  const traded = asTokens(tradedRes);
  const recent = asTokens(recentRes);
  remember(trending);
  remember(organic);
  remember(traded);
  remember(recent);

  const boosted = new Set(solanaMints(boostRes));
  const profiles = solanaMints(profileRes);
  const missing = [...new Set([...boosted, ...profiles])].filter((mint) => !byMint.has(mint));
  if (missing.length) {
    try {
      for (const token of await jupSearch(missing.slice(0, 80))) {
        if (token?.id && !byMint.has(token.id)) byMint.set(token.id, token);
      }
    } catch {
      notes.push("Some DEX Screener tokens could not be priced on Jupiter.");
    }
  }

  let pairMap = new Map<string, DexPair>();
  const pairIds = [...new Set([...trending, ...recent].map((token) => token.id))].slice(0, 30);
  if (pairIds.length) {
    try {
      const pairs = await dexGet(`/tokens/v1/solana/${pairIds.join(",")}`);
      if (Array.isArray(pairs)) pairMap = bestPairs(pairs as DexPair[]);
    } catch {
      notes.push("DEX Screener pair details were skipped this scan.");
    }
  }

  const toScan = (token: JupToken) => {
    const pair = pairMap.get(token.id);
    return fromJup(token, {
      boosted: boosted.has(token.id),
      dex: pair?.dexId ?? null,
      dexUrl: pair?.url ?? null,
    });
  };

  const scanByMint = new Map<string, ScanToken>();
  for (const token of byMint.values()) scanByMint.set(token.id, toScan(token));

  const unresolved = missing.filter((mint) => !scanByMint.has(mint)).slice(0, 30);
  if (unresolved.length) {
    try {
      const pairs = await dexGet(`/tokens/v1/solana/${unresolved.join(",")}`);
      if (Array.isArray(pairs)) {
        for (const pair of bestPairs(pairs as DexPair[]).values()) {
          const token = fromDex(pair, boosted.has(pair.baseToken?.address ?? ""));
          if (token && !scanByMint.has(token.mint)) scanByMint.set(token.mint, token);
        }
      }
    } catch {
      notes.push("A few new profiles had no tradable Solana pair.");
    }
  }

  const tokens = [...scanByMint.values()];
  const orderOf = (list: JupToken[]) =>
    list.map((token) => scanByMint.get(token.id)).filter((token): token is ScanToken => !!token);

  const launches = tokens
    .filter((token) => {
      if (recent.some((item) => item.id === token.mint)) return true;
      if (!token.poolCreatedAt) return false;
      const age = Date.now() - Date.parse(token.poolCreatedAt);
      return age >= 0 && age < 7 * 24 * 60 * 60 * 1000;
    })
    .sort((a, b) => Date.parse(b.poolCreatedAt ?? "") - Date.parse(a.poolCreatedAt ?? ""))
    .slice(0, 40);

  const ranked = tokens
    .filter((token) => !MAJORS.has(token.mint) && !isStable(token) && token.screenScore != null)
    .sort((a, b) => (b.screenScore ?? 0) - (a.screenScore ?? 0) || (b.volume24h ?? 0) - (a.volume24h ?? 0))
    .slice(0, 40);

  const concentration = tokens
    .filter((token) => token.topHoldersPct != null && (token.holders ?? 0) >= 30)
    .sort((a, b) => (b.topHoldersPct ?? 0) - (a.topHoldersPct ?? 0))
    .slice(0, 15);

  const flow = tokens
    .filter((token) => token.netFlow24h != null && (token.volume24h ?? 0) >= 20_000)
    .sort((a, b) => (b.netFlow24h ?? 0) - (a.netFlow24h ?? 0))
    .slice(0, 15);

  const sol = priceRes?.[NATIVE_SOL];
  return {
    ok: true,
    message: jupiterOk ? null : notes[0] ?? "Jupiter did not respond.",
    scannedAt: now.toISOString(),
    dayKey: now.toISOString().slice(0, 10),
    solPrice: num(sol?.usdPrice),
    solChange24h: num(sol?.priceChange24h),
    sources: { jupiter: jupiterOk, dexscreener: dexOk, notes },
    trending: orderOf(trending).slice(0, 40),
    traded: orderOf(traded).slice(0, 30),
    launches,
    ranked,
    concentration,
    flow,
  };
}

export async function loadScan(force = false): Promise<MarketScan> {
  if (!force && cache && Date.now() - cache.at < TTL) return cache.data;
  const data = await compute();
  if (data.ok) cache = { at: Date.now(), data };
  return data;
}

export async function loadToken(mint: string): Promise<TokenDetail> {
  const scan = await loadScan(false);
  const pools = [
    ...scan.trending,
    ...scan.traded,
    ...scan.launches,
    ...scan.ranked,
    ...scan.concentration,
    ...scan.flow,
  ];
  let token = pools.find((item) => item.mint === mint) ?? null;
  if (!token) {
    try {
      const found = await jupSearch([mint]);
      const match = found.find((item) => item.id === mint);
      if (match) token = fromJup(match);
    } catch {
      token = null;
    }
  }

  let pair: TokenDetail["pair"] = null;
  try {
    const pairs = await dexGet(`/tokens/v1/solana/${mint}`);
    if (Array.isArray(pairs) && pairs.length) {
      const best = bestPairs(pairs as DexPair[]).get(mint) ?? (pairs[0] as DexPair);
      const price = best.priceUsd != null ? Number(best.priceUsd) : null;
      pair = {
        dexId: best.dexId ?? null,
        url: best.url || `https://dexscreener.com/solana/${mint}`,
        buys24h: num(best.txns?.h24?.buys),
        sells24h: num(best.txns?.h24?.sells),
        volume24h: num(best.volume?.h24),
        liquidityUsd: num(best.liquidity?.usd),
        priceUsd: price != null && Number.isFinite(price) ? price : null,
      };
      if (!token) token = fromDex(best, false);
    }
  } catch {
    pair = null;
  }

  if (!token && !pair) {
    return { token: null, pair: null, message: "No Jupiter or DEX Screener market for this mint." };
  }
  return { token, pair, message: null };
}
