import { useQuery, useQueryClient } from "@tanstack/react-query";
import { createFileRoute } from "@tanstack/react-router";
import { useMemo, useState } from "react";
import { EmptyScan, SourceLine, TokenRow } from "@/components/market";
import { Button, Panel } from "@/components/ui";
import type { ScanToken } from "@/lib/market/types";
import { getMarketScan } from "@/lib/server/fns";
import { useSettings } from "@/lib/stores";
import { cn } from "@/lib/utils";

export const Route = createFileRoute("/scanner")({
  loader: () => getMarketScan({ data: { force: false } }),
  component: ScannerPage,
});

const TABS = [
  { id: "ranked", label: "Ranked" },
  { id: "launches", label: "New" },
  { id: "concentration", label: "Whales" },
  { id: "flow", label: "Buy flow" },
] as const;

type TabId = (typeof TABS)[number]["id"];

function ScannerPage() {
  const initial = Route.useLoaderData();
  const lite = useSettings((state) => state.lite);
  const queryClient = useQueryClient();
  const query = useQuery({
    queryKey: ["scan"],
    queryFn: () => getMarketScan({ data: { force: false } }),
    initialData: initial,
    staleTime: 60_000,
    refetchInterval: lite ? 300_000 : 90_000,
  });
  const scan = query.data;
  const [tab, setTab] = useState<TabId>("ranked");
  const [queryText, setQueryText] = useState("");
  const [floor, setFloor] = useState(0);
  const [hideHigh, setHideHigh] = useState(false);
  const [sort, setSort] = useState<"score" | "volume" | "liquidity" | "new" | "change">("score");
  const [refreshing, setRefreshing] = useState(false);

  const rows = useMemo(() => {
    const source = scan[tab];
    const q = queryText.trim().toLowerCase();
    const filtered = source.filter((token) => {
      if (hideHigh && token.riskLevel === "high") return false;
      if ((token.liquidity ?? 0) < floor) return false;
      if (!q) return true;
      return (
        token.symbol.toLowerCase().includes(q) ||
        token.name.toLowerCase().includes(q) ||
        token.mint.toLowerCase().includes(q)
      );
    });
    const copy = [...filtered];
    copy.sort((a, b) => compareTokens(a, b, sort));
    return copy;
  }, [scan, tab, queryText, floor, hideHigh, sort]);

  const now = Date.parse(scan.scannedAt);

  async function refresh() {
    setRefreshing(true);
    try {
      const next = await getMarketScan({ data: { force: true } });
      queryClient.setQueryData(["scan"], next);
    } finally {
      setRefreshing(false);
    }
  }

  return (
    <div className="space-y-6">
      <header className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <p className="text-sm font-semibold tracking-[0.16em] text-primary">DAILY SCANNER</p>
          <h1 className="mt-2 text-3xl font-semibold sm:text-4xl">Solana, from public prints only.</h1>
          <div className="mt-3">
            <SourceLine scan={scan} />
          </div>
        </div>
        <Button variant="line" onClick={() => void refresh()} disabled={refreshing}>
          {refreshing ? "Scanning…" : "Scan now"}
        </Button>
      </header>

      <Panel>
        <div className="flex gap-2 overflow-x-auto">
          {TABS.map((item) => (
            <button
              key={item.id}
              type="button"
              onClick={() => setTab(item.id)}
              className={cn(
                "h-11 shrink-0 rounded-full px-4 text-sm font-semibold",
                tab === item.id ? "bg-primary text-ink" : "bg-raised text-fg",
              )}
            >
              {item.label}
            </button>
          ))}
        </div>
        <div className="mt-4 grid gap-3 md:grid-cols-[minmax(0,1fr)_auto_auto]">
          <input
            value={queryText}
            onChange={(event) => setQueryText(event.target.value)}
            placeholder="Symbol, name, or mint"
            className="h-11 rounded-2xl bg-bg px-3 text-sm ring-1 ring-line outline-none focus:ring-primary"
          />
          <select
            value={sort}
            onChange={(event) => setSort(event.target.value as typeof sort)}
            className="h-11 rounded-2xl bg-bg px-3 text-sm ring-1 ring-line"
          >
            <option value="score">Screen score</option>
            <option value="volume">24h volume</option>
            <option value="liquidity">Liquidity</option>
            <option value="change">24h change</option>
            <option value="new">Newest pool</option>
          </select>
          <button
            type="button"
            onClick={() => setHideHigh((value) => !value)}
            className={cn(
              "h-11 rounded-full px-4 text-sm font-semibold",
              hideHigh ? "bg-primary text-ink" : "bg-raised text-fg",
            )}
          >
            Hide high risk
          </button>
        </div>
        <div className="mt-3 flex flex-wrap gap-2">
          {[
            [0, "Any liquidity"],
            [25_000, "$25k+"],
            [100_000, "$100k+"],
            [1_000_000, "$1M+"],
          ].map(([value, label]) => (
            <button
              key={label}
              type="button"
              onClick={() => setFloor(Number(value))}
              className={cn(
                "h-10 rounded-full px-3 text-sm",
                floor === Number(value) ? "bg-primary text-ink" : "text-muted ring-1 ring-line",
              )}
            >
              {label}
            </button>
          ))}
        </div>
        <p className="mt-4 text-sm text-muted">
          {tab === "concentration"
            ? "Holder concentration from Jupiter audit fields. Individual whale wallets are not inferred."
            : tab === "flow"
              ? "Net buy flow is Jupiter 24h buy volume minus sell volume, in USD."
              : "Screen score uses liquidity, volume, holders, organic score, then subtracts risk flags. Paid boosts do not raise it."}
        </p>
        <div className="mt-2 hidden text-xs text-faint sm:grid sm:grid-cols-[minmax(0,1.5fr)_repeat(4,minmax(0,0.7fr))]">
          <span>Token</span>
          <span>Price</span>
          <span>24h</span>
          <span>Volume</span>
          <span>Score</span>
        </div>
        {rows.length ? (
          rows.map((token) => <TokenRow key={token.mint} token={token} now={now} />)
        ) : (
          <EmptyScan text="Nothing matches these filters." />
        )}
      </Panel>
    </div>
  );
}

function compareTokens(a: ScanToken, b: ScanToken, sort: "score" | "volume" | "liquidity" | "new" | "change") {
  if (sort === "volume") return (b.volume24h ?? -1) - (a.volume24h ?? -1);
  if (sort === "liquidity") return (b.liquidity ?? -1) - (a.liquidity ?? -1);
  if (sort === "change") return (b.change24h ?? -9999) - (a.change24h ?? -9999);
  if (sort === "new") return Date.parse(b.poolCreatedAt ?? "") - Date.parse(a.poolCreatedAt ?? "");
  return (b.screenScore ?? -1) - (a.screenScore ?? -1);
}
