import type { RiskFlag, ScanToken } from "@/lib/market/types";

type ScoreInput = Omit<ScanToken, "risk" | "riskLevel" | "screenScore">;

function clamp(value: number, min = 0, max = 1) {
  return Math.min(max, Math.max(min, value));
}

export function assess(token: ScoreInput): Pick<ScanToken, "risk" | "riskLevel" | "screenScore"> {
  const risk: RiskFlag[] = [];
  const liquidity = token.liquidity;
  if (liquidity != null && liquidity < 10_000) {
    risk.push({ id: "liq-high", level: "high", label: "Liquidity under $10k" });
  } else if (liquidity != null && liquidity < 40_000) {
    risk.push({ id: "liq-watch", level: "watch", label: "Liquidity under $40k" });
  }

  if (token.mintAuthorityDisabled === false) {
    risk.push({ id: "mint", level: "high", label: "Mint authority is still enabled" });
  }
  if (token.freezeAuthorityDisabled === false) {
    risk.push({ id: "freeze", level: "watch", label: "Freeze authority is enabled" });
  }

  const holdersPct = token.topHoldersPct;
  if (holdersPct != null && holdersPct >= 40) {
    risk.push({ id: "whales", level: "high", label: "Top holders control 40% or more" });
  } else if (holdersPct != null && holdersPct >= 20) {
    risk.push({ id: "whales-watch", level: "watch", label: "Top holders control 20% or more" });
  }

  if (token.poolCreatedAt) {
    const age = Date.now() - Date.parse(token.poolCreatedAt);
    if (Number.isFinite(age) && age >= 0 && age < 60 * 60 * 1000) {
      risk.push({ id: "age", level: "high", label: "First pool is under 1 hour old" });
    } else if (Number.isFinite(age) && age >= 0 && age < 24 * 60 * 60 * 1000) {
      risk.push({ id: "age-day", level: "watch", label: "First pool is under 24 hours old" });
    }
  }

  if (token.organicLabel === "low") {
    risk.push({ id: "organic", level: "watch", label: "Jupiter organic score is low" });
  }
  if (token.holders != null && token.holders < 100) {
    risk.push({ id: "holders", level: "watch", label: "Fewer than 100 holders" });
  }
  if (token.change24h != null && Math.abs(token.change24h) >= 150) {
    risk.push({ id: "move", level: "watch", label: "24h price move is over 150%" });
  }
  if (token.boosted) {
    risk.push({
      id: "boost",
      level: "info",
      label: "Paid DEX Screener boost — not treated as demand",
    });
  }

  let riskLevel: ScanToken["riskLevel"] = "clear";
  if (risk.some((flag) => flag.level === "high")) riskLevel = "high";
  else if (risk.some((flag) => flag.level === "watch")) riskLevel = "watch";

  return { risk, riskLevel, screenScore: scoreOf(token, risk) };
}

function scoreOf(token: ScoreInput, risk: RiskFlag[]): number | null {
  if (token.priceUsd == null || token.liquidity == null || token.liquidity < 5_000) return null;
  const liquidity = clamp(Math.log10(token.liquidity) / 7);
  const volume = clamp(Math.log10(Math.max(token.volume24h ?? 1, 1)) / 7);
  const holders = clamp(Math.log10(Math.max(token.holders ?? 1, 1)) / 5);
  const organic =
    token.organicScore == null ? 0.35 : clamp(token.organicScore / 100);
  let score = liquidity * 28 + volume * 24 + holders * 18 + organic * 30;
  for (const flag of risk) {
    if (flag.level === "high") score -= 16;
    else if (flag.level === "watch") score -= 7;
  }
  return Math.max(0, Math.min(100, Math.round(score)));
}
