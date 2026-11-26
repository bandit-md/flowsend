export type PortfolioToken = {
  mint: string;
  symbol: string;
  name: string;
  icon: string | null;
  decimals: number;
  amountRaw: string;
  uiAmount: string;
  usd: number | null;
  program: "spl" | "token-2022";
};

export type Portfolio = {
  address: string;
  solLamports: string;
  solUi: string;
  solUsd: number | null;
  solPrice: number | null;
  tokens: PortfolioToken[];
  totalUsd: number | null;
  fetchedAt: string;
  partialPrices: boolean;
  truncated: boolean;
};

export type HistoryTokenDelta = {
  mint: string;
  deltaRaw: string;
  decimals: number;
  ui: string;
};

export type HistoryRow = {
  signature: string;
  slot: number;
  time: number | null;
  err: string | null;
  feeLamports: number;
  solDelta: number | null;
  tokens: HistoryTokenDelta[];
  label: string;
};

export type NetworkStatus = {
  health: "ok" | "degraded";
  slot: number;
  epoch: number;
  epochProgress: number;
  tps: number;
  blockhash: string;
  baseFeeLamports: number;
  fetchedAt: string;
  cluster: "mainnet-beta";
};

export type MintInspect = {
  mint: string;
  exists: boolean;
  program: "spl" | "token-2022" | "other" | null;
  decimals: number | null;
  supplyUi: string | null;
  mintAuthority: string | null;
  freezeAuthority: string | null;
  confidential: boolean;
  extensions: string[];
  deposit: "unsupported" | "wallet-proof";
  withdraw: "unsupported" | "wallet-proof";
  reason: string;
};

export type PrepareResult = {
  txBase64: string;
  networkFeeLamports: number;
  ataRentLamports: number;
  summary: string;
  decimals: number;
  amountRaw: string;
  symbol: string;
};
