export type RiskLevel = "info" | "watch" | "high";

export type RiskFlag = {
  id: string;
  level: RiskLevel;
  label: string;
};

export type ScanToken = {
  mint: string;
  name: string;
  symbol: string;
  icon: string | null;
  decimals: number;
  priceUsd: number | null;
  mcap: number | null;
  fdv: number | null;
  liquidity: number | null;
  holders: number | null;
  organicScore: number | null;
  organicLabel: string | null;
  verified: boolean;
  tags: string[];
  tokenProgram: string | null;
  poolCreatedAt: string | null;
  change5m: number | null;
  change1h: number | null;
  change6h: number | null;
  change24h: number | null;
  volume24h: number | null;
  buyVolume24h: number | null;
  sellVolume24h: number | null;
  netFlow24h: number | null;
  traders24h: number | null;
  topHoldersPct: number | null;
  mintAuthorityDisabled: boolean | null;
  freezeAuthorityDisabled: boolean | null;
  boosted: boolean;
  dex: string | null;
  dexscreenerUrl: string;
  sources: Array<"jupiter" | "dexscreener">;
  risk: RiskFlag[];
  riskLevel: "clear" | "watch" | "high";
  screenScore: number | null;
};

export type MarketScan = {
  ok: boolean;
  message: string | null;
  scannedAt: string;
  dayKey: string;
  solPrice: number | null;
  solChange24h: number | null;
  sources: { jupiter: boolean; dexscreener: boolean; notes: string[] };
  trending: ScanToken[];
  traded: ScanToken[];
  launches: ScanToken[];
  ranked: ScanToken[];
  concentration: ScanToken[];
  flow: ScanToken[];
};

export type JupStats = {
  priceChange?: number;
  buyVolume?: number;
  sellVolume?: number;
  numBuys?: number;
  numSells?: number;
  numTraders?: number;
};

export type JupToken = {
  id: string;
  name?: string;
  symbol?: string;
  icon?: string | null;
  decimals?: number;
  holderCount?: number;
  fdv?: number;
  mcap?: number;
  usdPrice?: number;
  liquidity?: number;
  organicScore?: number;
  organicScoreLabel?: string;
  isVerified?: boolean;
  tags?: string[];
  tokenProgram?: string;
  audit?: {
    mintAuthorityDisabled?: boolean | null;
    freezeAuthorityDisabled?: boolean | null;
    topHoldersPercentage?: number | null;
  };
  firstPool?: { id?: string; createdAt?: string };
  stats5m?: JupStats;
  stats1h?: JupStats;
  stats6h?: JupStats;
  stats24h?: JupStats;
};

export type TokenDetail = {
  token: ScanToken | null;
  pair: {
    dexId: string | null;
    url: string;
    buys24h: number | null;
    sells24h: number | null;
    volume24h: number | null;
    liquidityUsd: number | null;
    priceUsd: number | null;
  } | null;
  message: string | null;
};
