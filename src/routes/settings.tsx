import { createFileRoute } from "@tanstack/react-router";
import * as Switch from "@radix-ui/react-switch";
import { Panel } from "@/components/ui";
import { EXPLORERS, type ExplorerId } from "@/lib/constants";
import { useActivity, useSettings } from "@/lib/stores";

export const Route = createFileRoute("/settings")({
  component: SettingsPage,
});

function SettingsPage() {
  const lite = useSettings((state) => state.lite);
  const hide = useSettings((state) => state.hideBalances);
  const explorer = useSettings((state) => state.explorer);
  const setLite = useSettings((state) => state.setLite);
  const setHide = useSettings((state) => state.setHideBalances);
  const setExplorer = useSettings((state) => state.setExplorer);
  const clear = useActivity((state) => state.clear);
  const count = useActivity((state) => state.items.length);

  return (
    <div className="space-y-6">
      <header>
        <p className="text-sm font-semibold tracking-[0.16em] text-primary">SETTINGS</p>
        <h1 className="mt-2 text-3xl font-semibold sm:text-4xl">Privacy stays on this device.</h1>
      </header>

      <Panel className="space-y-5">
        <Toggle
          label="Lite mode"
          detail="Stops motion, drops the grid, and refreshes market data less often."
          checked={lite}
          onChange={setLite}
        />
        <Toggle
          label="Hide balances"
          detail="Blurs amounts in the wallet. It does not change what is public on Solana."
          checked={hide}
          onChange={setHide}
        />
        <label className="block">
          <span className="text-sm font-semibold">Explorer</span>
          <span className="mt-1 block text-sm text-muted">Used for transaction and address links.</span>
          <select
            value={explorer}
            onChange={(event) => setExplorer(event.target.value as ExplorerId)}
            className="mt-3 h-11 w-full max-w-xs rounded-2xl bg-bg px-3 text-sm ring-1 ring-line"
          >
            {EXPLORERS.map((item) => (
              <option key={item} value={item}>
                {item === "explorer" ? "Solana Explorer" : item === "solanafm" ? "SolanaFM" : "Solscan"}
              </option>
            ))}
          </select>
        </label>
      </Panel>

      <Panel>
        <h2 className="text-lg font-semibold">Local activity</h2>
        <p className="mt-2 text-sm text-muted">
          {count
            ? `${count} signature${count === 1 ? "" : "s"} saved in this browser from transfers you sent.`
            : "No local signatures yet."}
        </p>
        <button
          type="button"
          onClick={() => clear()}
          className="mt-4 h-11 rounded-full px-4 text-sm font-semibold text-danger ring-1 ring-danger/40"
        >
          Clear local activity
        </button>
      </Panel>

      <Panel>
        <h2 className="text-lg font-semibold">What this app will not do</h2>
        <ul className="mt-3 space-y-2 text-sm text-muted">
          <li>Store a seed phrase, private key, or confidential-balance decryption key.</li>
          <li>Sign a transaction without your wallet.</li>
          <li>Invent prices, volume, holders, or whale wallets.</li>
          <li>Pretend a public transfer is private.</li>
        </ul>
        <p className="mt-4 text-sm text-faint">
          Data sources: Jupiter Tokens API v2, Jupiter Price API v3, DEX Screener, and Solana mainnet JSON-RPC. The Jupiter key stays on the server.
        </p>
      </Panel>
    </div>
  );
}

function Toggle({
  label,
  detail,
  checked,
  onChange,
}: {
  label: string;
  detail: string;
  checked: boolean;
  onChange: (value: boolean) => void;
}) {
  return (
    <div className="flex items-center justify-between gap-4">
      <span>
        <span className="block text-sm font-semibold">{label}</span>
        <span className="mt-1 block text-sm text-muted">{detail}</span>
      </span>
      <Switch.Root
        checked={checked}
        onCheckedChange={onChange}
        className="relative h-7 w-12 shrink-0 rounded-full bg-raised data-[state=checked]:bg-primary"
        aria-label={label}
      >
        <Switch.Thumb className="block size-5 translate-x-1 rounded-full bg-fg transition-transform data-[state=checked]:translate-x-6 data-[state=checked]:bg-ink" />
      </Switch.Root>
    </div>
  );
}
