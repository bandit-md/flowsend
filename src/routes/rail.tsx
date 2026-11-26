import { useQuery } from "@tanstack/react-query";
import { createFileRoute } from "@tanstack/react-router";
import { useState } from "react";
import { Button, Field, Panel } from "@/components/ui";
import { USDC } from "@/lib/constants";
import type { MintInspect } from "@/lib/chain/types";
import { formatUtc, solLabel } from "@/lib/format";
import { getNetwork, inspectMintFn } from "@/lib/server/fns";
import { useSettings } from "@/lib/stores";

export const Route = createFileRoute("/rail")({
  loader: () => getNetwork(),
  component: RailPage,
});

function RailPage() {
  const initial = Route.useLoaderData();
  const lite = useSettings((state) => state.lite);
  const network = useQuery({
    queryKey: ["network"],
    queryFn: () => getNetwork(),
    initialData: initial,
    staleTime: 15_000,
    refetchInterval: lite ? 120_000 : 20_000,
  });
  const status = network.data;
  const [mint, setMint] = useState(USDC);
  const [report, setReport] = useState<MintInspect | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [pending, setPending] = useState(false);

  async function check(target = mint) {
    setPending(true);
    setError(null);
    try {
      setReport(await inspectMintFn({ data: { mint: target.trim() } }));
    } catch (err) {
      setReport(null);
      setError(err instanceof Error ? err.message : "Mint check failed.");
    } finally {
      setPending(false);
    }
  }

  const progress = Math.max(0, Math.min(100, Math.round(status.epochProgress * 100)));

  return (
    <div className="space-y-6">
      <header>
        <p className="text-sm font-semibold tracking-[0.16em] text-primary">ZK RAIL</p>
        <h1 className="mt-2 text-3xl font-semibold sm:text-4xl">Privacy only where the mint allows it.</h1>
        <p className="mt-3 max-w-2xl text-muted">
          Solana mainnet-beta is the only connected network. Confidential deposits and withdrawals require the Token-2022 extension and a proof from your wallet. FlowSend reads the mint and stops there.
        </p>
      </header>

      <section className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        <Stat label="Cluster" value="mainnet-beta" hint={status.health === "ok" ? "RPC healthy" : "RPC degraded"} />
        <Stat label="Slot" value={String(status.slot)} hint={`Epoch ${status.epoch}`} />
        <Stat label="TPS" value={String(Math.round(status.tps))} hint="Recent sample" />
        <Stat label="Base fee" value={solLabel(status.baseFeeLamports)} hint="Per signature" />
      </section>

      <Panel>
        <div className="flex items-center justify-between gap-3 text-sm">
          <span>Epoch progress</span>
          <span className="tabular-nums text-muted">{progress}%</span>
        </div>
        <div className="mt-3 h-2 overflow-hidden rounded-full bg-raised">
          <div className="h-full bg-primary" style={{ width: `${progress}%` }} />
        </div>
        <p className="mt-3 text-xs text-faint">
          Blockhash {status.blockhash.slice(0, 10)}… · updated {formatUtc(Date.parse(status.fetchedAt))}
          {network.isFetching ? " · refreshing" : ""}
        </p>
      </Panel>

      <div className="grid gap-4 lg:grid-cols-2">
        <Panel>
          <h2 className="text-lg font-semibold">What stays public</h2>
          <ul className="mt-3 space-y-2 text-sm text-muted">
            <li>Standard SOL and SPL transfers: sender, recipient, amount, and fee.</li>
            <li>Mint address, token accounts, and owners, even for confidential mints.</li>
            <li>The fact that a transaction landed, and the network fee.</li>
          </ul>
          <h2 className="mt-6 text-lg font-semibold">What a confidential mint can hide</h2>
          <ul className="mt-3 space-y-2 text-sm text-muted">
            <li>The transfer amount, when Token-2022 confidential transfers are enabled.</li>
            <li>The available confidential balance. The proof is produced by the wallet.</li>
          </ul>
        </Panel>
        <Panel>
          <h2 className="text-lg font-semibold">Mint support</h2>
          <div className="mt-4 space-y-4">
            <Field label="Mint address" value={mint} spellCheck={false} onChange={(event) => setMint(event.target.value)} />
            <div className="flex flex-wrap gap-2">
              <Button onClick={() => void check()} disabled={pending}>
                {pending ? "Checking chain…" : "Check mint"}
              </Button>
              <Button
                variant="line"
                onClick={() => {
                  setMint(USDC);
                  void check(USDC);
                }}
              >
                Check USDC
              </Button>
            </div>
            {error ? <p className="text-sm text-danger">{error}</p> : null}
            {report ? <Report report={report} /> : <p className="text-sm text-muted">No mint checked yet.</p>}
          </div>
        </Panel>
      </div>

      <Panel>
        <h2 className="text-lg font-semibold">Deposit and withdraw</h2>
        <p className="mt-2 text-sm text-muted">
          {report
            ? report.reason
            : "Run a mint check. Both actions stay disabled until the chain says the confidential extension is present — and even then the proof is not built here."}
        </p>
        <div className="mt-4 grid gap-3 sm:grid-cols-2">
          <Action
            title="Deposit"
            state={report?.deposit ?? "unsupported"}
            detail={report?.confidential ? "Wallet must attach the zero-knowledge proof." : "Not available for this mint."}
          />
          <Action
            title="Withdraw"
            state={report?.withdraw ?? "unsupported"}
            detail={report?.confidential ? "Decryption keys are never stored by FlowSend." : "Not available for this mint."}
          />
        </div>
      </Panel>
    </div>
  );
}

function Stat({ label, value, hint }: { label: string; value: string; hint: string }) {
  return (
    <div className="rounded-3xl bg-surface p-5 shadow-card">
      <p className="text-sm text-muted">{label}</p>
      <p className="mt-2 text-2xl font-semibold tabular-nums">{value}</p>
      <p className="mt-1 text-xs text-faint">{hint}</p>
    </div>
  );
}

function Report({ report }: { report: MintInspect }) {
  return (
    <dl className="grid gap-2 text-sm">
      <Item label="Program" value={report.program ?? "—"} />
      <Item label="Confidential extension" value={report.confidential ? "Present" : "Absent"} />
      <Item label="Decimals" value={report.decimals == null ? "—" : String(report.decimals)} />
      <Item label="Supply" value={displaySupply(report.supplyUi)} />
      <Item label="Mint authority" value={report.mintAuthority ? "Set" : "None"} />
      <Item label="Freeze authority" value={report.freezeAuthority ? "Set" : "None"} />
      {report.extensions.length ? (
        <Item label="Extensions" value={report.extensions.slice(0, 6).join(", ")} />
      ) : null}
    </dl>
  );
}

function displaySupply(value: string | null) {
  if (!value) return "—";
  const amount = Number(value);
  if (!Number.isFinite(amount)) return value;
  if (amount >= 1e9) return `${(amount / 1e9).toFixed(2)}B`;
  if (amount >= 1e6) return `${(amount / 1e6).toFixed(2)}M`;
  if (amount >= 1e3) return `${(amount / 1e3).toFixed(2)}K`;
  return amount.toFixed(2);
}

function Item({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex justify-between gap-4 border-b border-line py-2">
      <dt className="text-muted">{label}</dt>
      <dd className="text-right">{value}</dd>
    </div>
  );
}

function Action({ title, state, detail }: { title: string; state: "unsupported" | "wallet-proof"; detail: string }) {
  return (
    <div className="rounded-2xl bg-bg p-4">
      <div className="flex items-center justify-between gap-3">
        <h3 className="font-semibold">{title}</h3>
        <span className="text-xs text-primary">{state === "wallet-proof" ? "Proof required" : "Closed"}</span>
      </div>
      <p className="mt-2 text-sm text-muted">{detail}</p>
      <Button className="mt-4" variant="line" disabled>
        {title} unavailable in browser
      </Button>
    </div>
  );
}
