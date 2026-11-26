import { useQuery } from "@tanstack/react-query";
import { createFileRoute } from "@tanstack/react-router";
import { EmptyScan, SourceLine, TokenRow } from "@/components/market";
import { Panel } from "@/components/ui";
import { getMarketScan } from "@/lib/server/fns";
import { useSettings } from "@/lib/stores";

export const Route = createFileRoute("/trending")({
  loader: () => getMarketScan({ data: { force: false } }),
  component: TrendingPage,
});

function TrendingPage() {
  const initial = Route.useLoaderData();
  const lite = useSettings((state) => state.lite);
  const query = useQuery({
    queryKey: ["scan"],
    queryFn: () => getMarketScan({ data: { force: false } }),
    initialData: initial,
    staleTime: 60_000,
    refetchInterval: lite ? 300_000 : 90_000,
  });
  const scan = query.data;
  const now = Date.parse(scan.scannedAt);

  return (
    <div className="space-y-6">
      <header>
        <p className="text-sm font-semibold tracking-[0.16em] text-primary">TRENDING</p>
        <h1 className="mt-2 text-3xl font-semibold sm:text-4xl">What Jupiter is ranking now.</h1>
        <div className="mt-3">
          <SourceLine scan={scan} />
        </div>
      </header>
      <div className="grid gap-4 lg:grid-cols-2">
        <Panel>
          <h2 className="text-lg font-semibold">Trending 24h</h2>
          <p className="mt-1 text-sm text-muted">Jupiter top trending order, unchanged.</p>
          {scan.trending.length ? (
            scan.trending.slice(0, 12).map((token) => <TokenRow key={token.mint} token={token} now={now} />)
          ) : (
            <EmptyScan text="Trending data did not load." />
          )}
        </Panel>
        <Panel>
          <h2 className="text-lg font-semibold">Most traded 24h</h2>
          <p className="mt-1 text-sm text-muted">Jupiter top traded. Volume is buy plus sell.</p>
          {scan.traded.length ? (
            scan.traded.slice(0, 12).map((token) => <TokenRow key={token.mint} token={token} now={now} />)
          ) : (
            <EmptyScan text="Trade ranking did not load." />
          )}
        </Panel>
      </div>
    </div>
  );
}
