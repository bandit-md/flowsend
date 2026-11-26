import { useQuery } from "@tanstack/react-query";
import { createFileRoute, Link } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import type { ComponentType } from "react";
import { TokenIcon } from "@/components/market";
import { Panel } from "@/components/ui";
import type { ScanToken } from "@/lib/market/types";
import { ageFrom, compactUsd, pct, shortAddr, toneClass } from "@/lib/format";
import { getTokenDetail } from "@/lib/server/fns";

export const Route = createFileRoute("/token/$mint")({
  loader: ({ params }) => getTokenDetail({ data: { mint: params.mint } }),
  component: TokenPage,
});

function TokenPage() {
  const { mint } = Route.useParams();
  const initial = Route.useLoaderData();
  const query = useQuery({
    queryKey: ["token", mint],
    queryFn: () => getTokenDetail({ data: { mint } }),
    initialData: initial,
    staleTime: 30_000,
  });
  const detail = query.data;
  const token = detail.token;
  const now = Date.now();

  return (
    <div className="space-y-6">
      <Link to="/scanner" className="text-sm font-semibold text-primary">
        Back to scanner
      </Link>
      {!token ? (
        <Panel>
          <h1 className="text-2xl font-semibold">No market</h1>
          <p className="mt-2 text-sm text-muted">{detail.message || "This mint has no Jupiter or DEX Screener record."}</p>
          <p className="mt-3 break-all font-mono text-xs text-faint">{mint}</p>
        </Panel>
      ) : (
        <>
          <header className="flex items-start gap-4">
            <TokenIcon symbol={token.symbol} icon={token.icon} />
            <div className="min-w-0">
              <p className="text-sm text-primary">{token.verified ? "Jupiter verified" : "Unverified"}</p>
              <h1 className="truncate text-3xl font-semibold">{token.symbol}</h1>
              <p className="truncate text-muted">{token.name}</p>
            </div>
          </header>

          <section className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
            <Tile label="Price" value={compactUsd(token.priceUsd)} />
            <Tile label="24h" value={pct(token.change24h)} className={toneClass(token.change24h)} />
            <Tile label="Liquidity" value={compactUsd(token.liquidity)} />
            <Tile label="Screen score" value={token.screenScore == null ? "—" : String(token.screenScore)} />
          </section>

          <div className="grid gap-4 lg:grid-cols-[minmax(0,1.1fr)_minmax(0,0.9fr)]">
            <Panel>
              <h2 className="text-lg font-semibold">Price change</h2>
              <p className="mt-1 text-sm text-muted">Jupiter interval stats. Missing windows stay flat and gray.</p>
              <LazyChart token={token} />
            </Panel>
            <Panel>
              <h2 className="text-lg font-semibold">Risk flags</h2>
              {token.risk.length ? (
                <ul className="mt-3 space-y-2">
                  {token.risk.map((flag) => (
                    <li key={flag.id} className="flex items-start justify-between gap-3 text-sm">
                      <span>{flag.label}</span>
                      <span className={flag.level === "high" ? "text-danger" : flag.level === "watch" ? "text-primary" : "text-faint"}>
                        {flag.level}
                      </span>
                    </li>
                  ))}
                </ul>
              ) : (
                <p className="mt-3 text-sm text-muted">No flags from the fields Jupiter returned.</p>
              )}
              <p className="mt-4 text-sm text-faint">A clear score is not a buy signal.</p>
            </Panel>
          </div>

          <Panel>
            <dl className="grid gap-3 sm:grid-cols-2">
              <Fact label="Market cap" value={compactUsd(token.mcap)} />
              <Fact label="FDV" value={compactUsd(token.fdv)} />
              <Fact label="Holders" value={token.holders == null ? "—" : String(Math.round(token.holders))} />
              <Fact label="Top holders" value={token.topHoldersPct == null ? "—" : `${token.topHoldersPct.toFixed(1)}%`} />
              <Fact label="24h volume" value={compactUsd(token.volume24h)} />
              <Fact label="Net buy flow" value={compactUsd(token.netFlow24h)} />
              <Fact label="Traders 24h" value={token.traders24h == null ? "—" : String(Math.round(token.traders24h))} />
              <Fact label="Organic score" value={token.organicScore == null ? "—" : token.organicScore.toFixed(1)} />
              <Fact label="Pool age" value={ageFrom(token.poolCreatedAt, now)} />
              <Fact label="DEX" value={detail.pair?.dexId || token.dex || "—"} />
              <Fact label="Buys / sells" value={detail.pair ? `${detail.pair.buys24h ?? "—"} / ${detail.pair.sells24h ?? "—"}` : "—"} />
              <Fact label="Mint authority" value={token.mintAuthorityDisabled == null ? "Unknown" : token.mintAuthorityDisabled ? "Disabled" : "Enabled"} />
            </dl>
            <p className="mt-4 break-all font-mono text-xs text-faint">{shortAddr(token.mint)} · {token.mint}</p>
            <a className="mt-3 inline-flex text-sm font-semibold text-primary" href={detail.pair?.url || token.dexscreenerUrl} target="_blank" rel="noreferrer">
              View on DEX Screener
            </a>
          </Panel>
        </>
      )}
    </div>
  );
}

function Tile({ label, value, className }: { label: string; value: string; className?: string }) {
  return (
    <div className="rounded-3xl bg-surface p-5 shadow-card">
      <p className="text-sm text-muted">{label}</p>
      <p className={`mt-2 text-2xl font-semibold tabular-nums ${className ?? ""}`}>{value}</p>
    </div>
  );
}

function Fact({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex items-center justify-between gap-3 border-b border-line py-2">
      <dt className="text-sm text-muted">{label}</dt>
      <dd className="tabular-nums">{value}</dd>
    </div>
  );
}

function LazyChart({ token }: { token: ScanToken }) {
  const [Chart, setChart] = useState<ComponentType<{ token: ScanToken }> | null>(null);
  useEffect(() => {
    let cancel = false;
    void import("@/components/change-chart").then((mod) => {
      if (!cancel) setChart(() => mod.ChangeChart);
    });
    return () => {
      cancel = true;
    };
  }, []);
  if (!Chart) return <div className="mt-4 h-52 rounded-2xl bg-raised" />;
  return (
    <div className="mt-4">
      <Chart token={token} />
    </div>
  );
}
