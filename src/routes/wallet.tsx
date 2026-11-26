import { useQuery, useQueryClient } from "@tanstack/react-query";
import { createFileRoute } from "@tanstack/react-router";
import { useState } from "react";
import { ReceiveCard } from "@/components/receive-card";
import { SendPanel } from "@/components/send-panel";
import { TokenIcon } from "@/components/market";
import { Button, Panel } from "@/components/ui";
import { useWallet } from "@/components/wallet-provider";
import { compactUsd } from "@/lib/format";
import { getPortfolio } from "@/lib/server/fns";
import { useSession, useSettings } from "@/lib/stores";
import { cn } from "@/lib/utils";

export const Route = createFileRoute("/wallet")({
  component: WalletPage,
});

function WalletPage() {
  const { installed, connect, disconnect, busy, ready } = useWallet();
  const address = useSession((state) => state.address);
  const wallet = useSession((state) => state.wallet);
  const hide = useSettings((state) => state.hideBalances);
  const lite = useSettings((state) => state.lite);
  const [pane, setPane] = useState<"balances" | "send" | "receive">("balances");
  const queryClient = useQueryClient();
  const portfolio = useQuery({
    queryKey: ["portfolio", address],
    queryFn: () => getPortfolio({ data: { address: address ?? "" } }),
    enabled: Boolean(address),
    staleTime: 15_000,
    refetchInterval: lite ? 120_000 : 30_000,
  });

  return (
    <div className="space-y-6">
      <header className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <p className="text-sm font-semibold tracking-[0.16em] text-primary">PRIVATE WALLET</p>
          <h1 className="mt-2 text-3xl font-semibold sm:text-4xl">Balances you sign for.</h1>
        </div>
        {address ? (
          <Button variant="line" onClick={() => void disconnect()}>
            Disconnect
          </Button>
        ) : null}
      </header>

      {!address ? (
        <Panel>
          <h2 className="text-lg font-semibold">Connect a wallet</h2>
          <p className="mt-2 max-w-xl text-sm text-muted">
            Phantom and Solflare keep the keys. FlowSend only receives the public address and asks the wallet to sign. This preview browser may not have an extension installed.
          </p>
          <div className="mt-5 flex flex-wrap gap-3">
            <Button disabled={!ready || busy} onClick={() => void connect("phantom")}>
              {installed.phantom ? "Connect Phantom" : "Phantom not detected"}
            </Button>
            <Button variant="line" disabled={!ready || busy} onClick={() => void connect("solflare")}>
              {installed.solflare ? "Connect Solflare" : "Solflare not detected"}
            </Button>
          </div>
          <p className="mt-4 text-sm text-faint">
            Install from{" "}
            <a className="text-primary" href="https://phantom.app/" target="_blank" rel="noreferrer">
              phantom.app
            </a>{" "}
            or{" "}
            <a className="text-primary" href="https://solflare.com/" target="_blank" rel="noreferrer">
              solflare.com
            </a>
            . FlowSend will never ask you to type a seed phrase.
          </p>
        </Panel>
      ) : (
        <div className="grid gap-4 lg:grid-cols-[minmax(0,0.9fr)_minmax(0,1.1fr)]">
          <Panel>
            <p className="text-sm text-muted">{wallet === "solflare" ? "Solflare" : "Phantom"}</p>
            <p className="mt-2 break-all font-mono text-sm">{address}</p>
            <p className={cn("mt-6 text-4xl font-semibold tabular-nums", hide && "blur-md select-none")}>
              {portfolio.data ? compactUsd(portfolio.data.totalUsd) : "—"}
            </p>
            <p className="mt-1 text-sm text-muted">
              {portfolio.isFetching ? "Reading mainnet…" : portfolio.data?.partialPrices ? "Some prices missing" : "Priced with Jupiter"}
            </p>
            {portfolio.error ? (
              <p className="mt-3 text-sm text-danger">
                {portfolio.error instanceof Error ? portfolio.error.message : "Could not load balances."}
              </p>
            ) : null}
            <div className="mt-4">
              <Button
                variant="line"
                onClick={() => void queryClient.invalidateQueries({ queryKey: ["portfolio", address] })}
              >
                Refresh balances
              </Button>
            </div>
          </Panel>

          <Panel>
            <div className="mb-5 flex gap-2">
              {(["balances", "send", "receive"] as const).map((item) => (
                <button
                  key={item}
                  type="button"
                  onClick={() => setPane(item)}
                  className={cn(
                    "h-11 rounded-full px-4 text-sm font-semibold capitalize",
                    pane === item ? "bg-primary text-ink" : "bg-raised text-fg",
                  )}
                >
                  {item}
                </button>
              ))}
            </div>
            {pane === "balances" ? (
              <BalanceList
                hide={hide}
                sol={portfolio.data?.solUi ?? "—"}
                solUsd={portfolio.data?.solUsd ?? null}
                tokens={portfolio.data?.tokens ?? []}
                truncated={portfolio.data?.truncated ?? false}
              />
            ) : null}
            {pane === "send" && portfolio.data ? <SendPanel portfolio={portfolio.data} /> : null}
            {pane === "send" && !portfolio.data ? <p className="text-sm text-muted">Balances are still loading.</p> : null}
            {pane === "receive" ? <ReceiveCard address={address} /> : null}
          </Panel>
        </div>
      )}
    </div>
  );
}

function BalanceList({
  hide,
  sol,
  solUsd,
  tokens,
  truncated,
}: {
  hide: boolean;
  sol: string;
  solUsd: number | null;
  tokens: Array<{ mint: string; symbol: string; name: string; icon: string | null; uiAmount: string; usd: number | null; program: string }>;
  truncated: boolean;
}) {
  return (
    <div className={cn("space-y-3", hide && "blur-md select-none")}>
      <div className="flex items-center justify-between gap-3 border-b border-line py-3">
        <span>
          <span className="block font-semibold">SOL</span>
          <span className="text-sm text-muted">Native</span>
        </span>
        <span className="text-right tabular-nums">
          <span className="block">{sol}</span>
          <span className="text-sm text-muted">{compactUsd(solUsd)}</span>
        </span>
      </div>
      {tokens.length ? (
        tokens.map((token) => (
          <div key={token.mint} className="flex items-center justify-between gap-3 border-b border-line py-3 last:border-b-0">
            <span className="flex min-w-0 items-center gap-3">
              <TokenIcon symbol={token.symbol} icon={token.icon} />
              <span className="min-w-0">
                <span className="block truncate font-semibold">{token.symbol}</span>
                <span className="block truncate text-sm text-muted">
                  {token.name}
                  {token.program === "token-2022" ? " · Token-2022" : ""}
                </span>
              </span>
            </span>
            <span className="text-right tabular-nums">
              <span className="block">{token.uiAmount}</span>
              <span className="text-sm text-muted">{compactUsd(token.usd)}</span>
            </span>
          </div>
        ))
      ) : (
        <p className="text-sm text-muted">No SPL token balances with a non-zero amount.</p>
      )}
      {truncated ? <p className="text-xs text-faint">Showing the first 100 token accounts.</p> : null}
    </div>
  );
}
