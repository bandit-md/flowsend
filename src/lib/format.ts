export function parseUiAmount(input: string, decimals: number): bigint {
  const text = input.trim();
  if (!/^\d+(\.\d+)?$/.test(text)) {
    throw new Error("Enter a positive amount using numbers only.");
  }
  if (text.length > 40) throw new Error("Amount is too long.");
  const [whole, frac = ""] = text.split(".");
  if (whole.length > 20) throw new Error("Amount is too large.");
  if (frac.length > decimals) {
    throw new Error(`This asset supports ${decimals} decimal places.`);
  }
  const padded = (frac + "0".repeat(decimals)).slice(0, decimals);
  const raw = BigInt(whole) * 10n ** BigInt(decimals) + BigInt(padded || "0");
  if (raw <= 0n) throw new Error("Enter an amount greater than zero.");
  return raw;
}

export function formatUnits(amount: bigint, decimals: number): string {
  const neg = amount < 0n;
  const value = neg ? -amount : amount;
  const base = 10n ** BigInt(decimals);
  const whole = value / base;
  const frac =
    decimals === 0
      ? ""
      : (value % base).toString().padStart(decimals, "0").replace(/0+$/, "");
  const text = frac ? `${whole.toString()}.${frac}` : whole.toString();
  return neg ? `-${text}` : text;
}

export function compactUsd(value: number | null | undefined): string {
  if (value == null || !Number.isFinite(value)) return "—";
  const sign = value < 0 ? "-" : "";
  const abs = Math.abs(value);
  if (abs >= 1e9) return `${sign}$${trim(abs / 1e9)}B`;
  if (abs >= 1e6) return `${sign}$${trim(abs / 1e6)}M`;
  if (abs >= 1e3) return `${sign}$${trim(abs / 1e3)}K`;
  if (abs >= 1) return `${sign}$${trim(abs)}`;
  if (abs === 0) return "$0";
  return `${sign}$${abs.toPrecision(2)}`;
}

export function preciseUsd(value: number | null | undefined): string {
  if (value == null || !Number.isFinite(value)) return "—";
  if (Math.abs(value) >= 1) return `$${value.toFixed(2)}`;
  if (value === 0) return "$0";
  return `$${value.toPrecision(3)}`;
}

function trim(value: number): string {
  if (value >= 100) return value.toFixed(0);
  if (value >= 10) return value.toFixed(1);
  return value.toFixed(2);
}

export function pct(value: number | null | undefined): string {
  if (value == null || !Number.isFinite(value)) return "—";
  const sign = value > 0 ? "+" : "";
  const digits = Math.abs(value) >= 100 ? 0 : 2;
  return `${sign}${value.toFixed(digits)}%`;
}

export function shortAddr(value: string): string {
  if (value.length <= 12) return value;
  return `${value.slice(0, 4)}…${value.slice(-4)}`;
}

export function ageFrom(iso: string | null, now: number): string {
  if (!iso) return "—";
  const then = Date.parse(iso);
  if (!Number.isFinite(then)) return "—";
  const seconds = Math.max(0, Math.floor((now - then) / 1000));
  if (seconds < 60) return `${seconds}s`;
  const minutes = Math.floor(seconds / 60);
  if (minutes < 60) return `${minutes}m`;
  const hours = Math.floor(minutes / 60);
  if (hours < 48) return `${hours}h`;
  return `${Math.floor(hours / 24)}d`;
}

const MONTHS = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];

export function formatUtc(ms: number | null): string {
  if (ms == null || !Number.isFinite(ms)) return "—";
  const date = new Date(ms);
  const day = date.getUTCDate();
  const hours = String(date.getUTCHours()).padStart(2, "0");
  const mins = String(date.getUTCMinutes()).padStart(2, "0");
  return `${MONTHS[date.getUTCMonth()]} ${day}, ${hours}:${mins} UTC`;
}

export function solLabel(lamports: number): string {
  return `${formatUnits(BigInt(Math.max(0, Math.round(lamports))), 9)} SOL`;
}

export function toneClass(value: number | null | undefined): string {
  if (value == null || !Number.isFinite(value) || value === 0) return "text-muted";
  return value > 0 ? "text-primary" : "text-danger";
}
