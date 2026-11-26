import { Link } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import type { MarketScan, ScanToken } from "@/lib/market/types";
import { ageFrom, compactUsd, pct, toneClass } from "@/lib/format";
import { cn } from "@/lib/utils";

export function SourceLine({ scan }: { scan: MarketScan }) {
  return (
    <p className="text-sm text-muted">
      Board {scan.dayKey} · scanned {scan.scannedAt.slice(11, 16)} UTC
      {scan.sources.jupiter ? " · Jupiter" : ""}
      {scan.sources.dexscreener ? " · DEX Screener" : ""}
      {scan.message ? ` · ${scan.message}` : ""}
    </p>
  );
}

export function TokenIcon({ symbol, icon }: { symbol: string; icon: string | null }) {
  const [failed, setFailed] = useState(false);
  useEffect(() => setFailed(false), [icon]);
  if (!icon || failed) {
    return (
      <span className="grid size-10 shrink-0 place-items-center rounded-full bg-raised text-xs font-semibold">
        {symbol.slice(0, 2).toUpperCase()}
      </span>
    );
  }
  return (
    <img
      src={icon}
      alt=""
      className="token-icon size-10 shrink-0 rounded-full object-cover"
      onError={() => setFailed(true)}
    />
  );
}

export function TokenRow({ token, now }: { token: ScanToken; now: number }) {
  return (
    <Link
      to="/token/$mint"
      params={{ mint: token.mint }}
      className="grid gap-3 border-b border-line py-4 last:border-b-0 sm:grid-cols-[minmax(0,1.5fr)_repeat(4,minmax(0,0.7fr))] sm:items-center"
    >
      <span className="flex min-w-0 items-center gap-3">
        <TokenIcon symbol={token.symbol} icon={token.icon} />
        <span className="min-w-0">
          <span className="flex items-center gap-2">
            <span className="truncate font-semibold">{token.symbol}</span>
            {token.verified ? <span className="text-xs text-primary">Verified</span> : null}
          </span>
          <span className="block truncate text-sm text-muted">
            {token.name} · {ageFrom(token.poolCreatedAt, now)}
            {token.topHoldersPct != null ? ` · top ${token.topHoldersPct.toFixed(0)}%` : ""}
          </span>
        </span>
      </span>
      <Metric label="Price" value={compactUsd(token.priceUsd)} />
      <Metric label="24h" value={pct(token.change24h)} className={toneClass(token.change24h)} />
      <Metric label="Volume" value={compactUsd(token.volume24h)} />
      <Metric
        label="Score"
        value={token.screenScore == null ? "—" : String(token.screenScore)}
        hint={token.riskLevel === "clear" ? "Clear" : token.riskLevel === "watch" ? "Watch" : "High risk"}
      />
    </Link>
  );
}

function Metric({
  label,
  value,
  className,
  hint,
}: {
  label: string;
  value: string;
  className?: string;
  hint?: string;
}) {
  return (
    <span className="flex items-baseline justify-between gap-3 sm:block">
      <span className="text-xs text-faint sm:hidden">{label}</span>
      <span>
        <span className={cn("block tabular-nums font-medium", className)}>{value}</span>
        {hint ? <span className="text-xs text-faint">{hint}</span> : null}
      </span>
    </span>
  );
}

export function EmptyScan({ text }: { text: string }) {
  return <p className="py-8 text-sm text-muted">{text}</p>;
}
