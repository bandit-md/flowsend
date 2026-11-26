import { useQuery } from "@tanstack/react-query";
import { createFileRoute, Link } from "@tanstack/react-router";
import { Panel } from "@/components/ui";
import { useWallet } from "@/components/wallet-provider";
import { addressUrl, txUrl } from "@/lib/explorers";
import { formatUtc, shortAddr, solLabel } from "@/lib/format";
import { getHistory } from "@/lib/server/fns";
import { useActivity, useSession, useSettings } from "@/lib/stores";

export const Route = createFileRoute("/transactions")({
  component: TransactionsPage,
});

function TransactionsPage() {
  const address = useSession((state) => state.address);
  const explorer = useSettings((state) => state.explorer);
  const lite = useSettings((state) => state.lite);
  const local = useActivity((state) => state.items);
  const { ready } = useWallet();
  const history = useQuery({
    queryKey: ["history", address],
    queryFn: () => getHistory({ data: { address: address ?? "" } }),
    enabled: Boolean(address),
    staleTime: 15_000,
    refetchInterval: lite ? 180_000 : 45_000,
  });
  const sentHere = new Set(local.map((item) => item.signature));

  return (
    <div className="space-y-6">
      <header>
        <p className="text-sm font-semibold tracking-[0.16em] text-primary">TRANSACTIONS</p>
        <h1 className="mt-2 text-3xl font-semibold sm:text-4xl">Public history, visible fees.</h1>
        <p className="mt-3 max-w-2xl text-muted">
          Recent signatures for the connected address, read from Solana. Fees come from the chain, not an estimate.
        </p>
      </header>

      {!address ? (
        <Panel>
          <p className="text-muted">Connect Phantom or Solflare to load history.</p>
          <Link to="/wallet" className="mt-4 inline-flex h-11 items-center rounded-full bg-primary px-4 text-sm font-semibold text-ink">
            Go to wallet
          </Link>
          {!ready ? <p className="mt-3 text-xs text-faint">Checking for a wallet extension…</p> : null}
        </Panel>
      ) : (
        <>
          {local.length ? (
            <Panel>
              <h2 className="text-lg font-semibold">Sent from this browser</h2>
              <p className="mt-1 text-sm text-muted">Stored locally: signature, amount, and recipient. No keys.</p>
              <ul className="mt-4 divide-y divide-line">
                {local.map((item) => (
                  <li key={item.signature} className="flex flex-wrap items-center justify-between gap-3 py-3">
                    <span>
                      <span className="block font-medium">
                        {item.amount} {item.asset}
                      </span>
                      <span className="text-sm text-muted">to {shortAddr(item.to)} · {formatUtc(item.at)}</span>
                    </span>
                    <a className="text-sm font-semibold text-primary" href={txUrl(explorer, item.signature)} target="_blank" rel="noreferrer">
                      {shortAddr(item.signature)}
                    </a>
                  </li>
                ))}
              </ul>
            </Panel>
          ) : null}

          <Panel>
            <div className="flex items-center justify-between gap-3">
              <h2 className="text-lg font-semibold">On-chain</h2>
              <a className="text-sm text-primary" href={addressUrl(explorer, address)} target="_blank" rel="noreferrer">
                Open explorer
              </a>
            </div>
            {history.isLoading ? <p className="mt-4 text-sm text-muted">Loading signatures…</p> : null}
            {history.error ? (
              <p className="mt-4 text-sm text-danger">
                {history.error instanceof Error ? history.error.message : "History failed."}
              </p>
            ) : null}
            {history.data?.length ? (
              <ul className="mt-2 divide-y divide-line">
                {history.data.map((row) => (
                  <li key={row.signature} className="grid gap-2 py-4 sm:grid-cols-[minmax(0,1fr)_auto] sm:items-center">
                    <span>
                      <span className="font-medium">
                        {row.label}
                        {row.err ? " · failed" : ""}
                        {sentHere.has(row.signature) ? " · sent here" : ""}
                      </span>
                      <span className="mt-1 block text-sm text-muted">
                        {formatUtc(row.time == null ? null : row.time * 1000)} · fee {solLabel(row.feeLamports)}
                        {row.solDelta != null ? ` · SOL change ${row.solDelta.toFixed(6)}` : ""}
                      </span>
                      {row.tokens.length ? (
                        <span className="mt-1 block text-sm text-faint">
                          {row.tokens.map((token) => `${token.ui} ${shortAddr(token.mint)}`).join(" · ")}
                        </span>
                      ) : null}
                    </span>
                    <a className="font-mono text-sm text-primary" href={txUrl(explorer, row.signature)} target="_blank" rel="noreferrer">
                      {shortAddr(row.signature)}
                    </a>
                  </li>
                ))}
              </ul>
            ) : history.data ? (
              <p className="mt-4 text-sm text-muted">No recent signatures for this address.</p>
            ) : null}
          </Panel>
        </>
      )}
    </div>
  );
}
