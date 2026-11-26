import { useQuery } from "@tanstack/react-query";
import { createFileRoute, Link } from "@tanstack/react-router";
import { Panel } from "@/components/ui";
import { EmptyScan, SourceLine, TokenRow } from "@/components/market";
import { compactUsd, pct, toneClass } from "@/lib/format";
import { getMarketScan } from "@/lib/server/fns";

export const Route = createFileRoute("/")({
  loader: () => getMarketScan({ data: { force: false } }),
  component: Home,
});

function Home() {
  const initial = Route.useLoaderData();
  const query = useQuery({
    queryKey: ["scan"],
    queryFn: () => getMarketScan({ data: { force: false } }),
    initialData: initial,
    staleTime: 60_000,
    refetchInterval: 90_000,
  });
  const scan = query.data;
  const now = Date.parse(scan.scannedAt);

  return (
    <div className="space-y-8">
      <section className="grid items-stretch gap-4 lg:grid-cols-[minmax(0,1.4fr)_minmax(18rem,0.8fr)]">
        <div className="py-2">
          <p className="text-sm font-semibold tracking-[0.18em] text-primary">PRIVATE SOLANA</p>
          <h1 className="mt-3 max-w-xl text-4xl font-semibold tracking-tight sm:text-6xl">
            Your keys stay in the wallet. The market does not.
          </h1>
          <p className="mt-4 max-w-xl text-base text-muted sm:text-lg">
            FlowSend connects Phantom or Solflare, shows live SOL and token balances, and ranks Solana markets from Jupiter and DEX Screener. It never asks for a seed phrase.
          </p>
          <div className="mt-6 flex flex-wrap gap-3">
            <Link to="/wallet" className="inline-flex h-11 items-center rounded-full bg-primary px-4 text-sm font-semibold text-ink">
              Open private wallet
            </Link>
            <Link to="/scanner" className="inline-flex h-11 items-center rounded-full px-4 text-sm font-semibold ring-1 ring-line">
              Daily scanner
            </Link>
          </div>
        </div>
        <Panel className="flex flex-col justify-between">
          <div className="flex items-center justify-between text-sm text-muted">
            <span>SOL / USD</span>
            <span className="inline-flex items-center gap-2">
              <span className="live-dot size-2 rounded-full bg-primary" />
              Jupiter price
            </span>
          </div>
          <p className="mt-6 text-5xl font-semibold tabular-nums tracking-tight">
            {compactUsd(scan.solPrice)}
          </p>
          <p className={`mt-2 text-lg tabular-nums ${toneClass(scan.solChange24h)}`}>
            {pct(scan.solChange24h)} <span className="text-sm text-muted">24h</span>
          </p>
          <SourceLine scan={scan} />
        </Panel>
      </section>

      <section className="grid gap-3 md:grid-cols-3">
        <Feature to="/wallet" kicker="01" title="Private wallet" body="Balances, receive QR, and transfers you sign yourself. Fees are shown before the wallet opens." />
        <Feature to="/scanner" kicker="02" title="Daily scanner" body="Screen score from liquidity, volume, holders, and Jupiter's organic score. Paid boosts are labeled, not rewarded." />
        <Feature to="/rail" kicker="03" title="ZK Rail" body="Live mainnet status, plus a mint check for Token-2022 confidential transfers. Unsupported rails stay closed." />
      </section>

      <Panel>
        <div className="mb-2 flex items-end justify-between gap-3">
          <div>
            <h2 className="text-xl font-semibold">Today's screen</h2>
            <p className="mt-1 text-sm text-muted">Highest screen scores, majors excluded. Not a recommendation.</p>
          </div>
          <Link to="/scanner" className="text-sm font-semibold text-primary">
            Full scanner
          </Link>
        </div>
        {scan.ranked.length ? (
          scan.ranked.slice(0, 5).map((token) => <TokenRow key={token.mint} token={token} now={now} />)
        ) : (
          <EmptyScan text={scan.ok ? "No tokens cleared the liquidity floor on this scan." : scan.message || "Market data is unavailable."} />
        )}
      </Panel>

      <Panel>
        <div className="mb-2 flex items-end justify-between gap-3">
          <div>
            <h2 className="text-xl font-semibold">New pools</h2>
            <p className="mt-1 text-sm text-muted">Recently opened markets. Age is a risk, not a reason to buy.</p>
          </div>
          <Link to="/scanner" className="text-sm font-semibold text-primary">
            See launches
          </Link>
        </div>
        {scan.launches.length ? (
          scan.launches.slice(0, 4).map((token) => <TokenRow key={token.mint} token={token} now={now} />)
        ) : (
          <EmptyScan text="No new pools in this scan." />
        )}
      </Panel>

      <p className="text-sm text-faint">Base network fee 0.000005 SOL. Seed phrases and private keys are never stored.</p>
    </div>
  );
}

function Feature({ to, kicker, title, body }: { to: "/wallet" | "/scanner" | "/rail"; kicker: string; title: string; body: string }) {
  return (
    <Link to={to} className="rounded-3xl bg-surface p-5 shadow-card">
      <p className="font-mono text-xs text-primary">{kicker}</p>
      <h2 className="mt-3 text-lg font-semibold">{title}</h2>
      <p className="mt-2 text-sm text-muted">{body}</p>
    </Link>
  );
}
