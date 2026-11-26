import { Link, useRouterState } from "@tanstack/react-router";
import {
  ArrowLeftRight,
  Compass,
  ScanSearch,
  Settings,
  TrendingUp,
  Wallet,
  Waypoints,
} from "lucide-react";
import { useEffect, type ReactNode } from "react";
import { Mark } from "@/components/ui";
import { useWallet } from "@/components/wallet-provider";
import { shortAddr } from "@/lib/format";
import { useActivity, useSession, useSettings } from "@/lib/stores";
import { cn } from "@/lib/utils";

const NAV = [
  { to: "/", label: "Home", icon: Compass },
  { to: "/wallet", label: "Private Wallet", icon: Wallet },
  { to: "/scanner", label: "Scanner", icon: ScanSearch },
  { to: "/trending", label: "Trending", icon: TrendingUp },
  { to: "/rail", label: "ZK Rail", icon: Waypoints },
  { to: "/transactions", label: "Transactions", icon: ArrowLeftRight },
  { to: "/settings", label: "Settings", icon: Settings },
] as const;

function active(pathname: string, to: string) {
  if (to === "/") return pathname === "/";
  return pathname === to || pathname.startsWith(`${to}/`);
}

export function Shell({ children }: { children: ReactNode }) {
  const pathname = useRouterState({ select: (state) => state.location.pathname });
  const lite = useSettings((state) => state.lite);
  const address = useSession((state) => state.address);
  const wallet = useSession((state) => state.wallet);
  const { ready } = useWallet();

  useEffect(() => {
    void useSettings.persist.rehydrate();
    void useActivity.persist.rehydrate();
  }, []);

  useEffect(() => {
    document.documentElement.dataset.lite = lite ? "1" : "0";
  }, [lite]);

  return (
    <div className="min-h-screen lg:pl-64">
      <aside className="fixed inset-y-0 left-0 z-30 hidden w-64 flex-col border-r border-line bg-bg px-4 py-5 lg:flex">
        <Link to="/" className="flex items-center gap-3 px-2">
          <Mark />
          <span className="text-lg font-semibold tracking-tight">FlowSend</span>
        </Link>
        <nav className="mt-8 flex flex-1 flex-col gap-1">
          {NAV.map((item) => {
            const Icon = item.icon;
            const on = active(pathname, item.to);
            return (
              <Link key={item.to} to={item.to} className={itemClass(on)}>
                <Icon className="size-4" aria-hidden="true" />
                {item.label}
              </Link>
            );
          })}
        </nav>
        <p className="rounded-2xl bg-surface px-3 py-3 text-xs text-muted">
          {ready && address ? (
            <>
              <span className="block text-fg">{wallet === "solflare" ? "Solflare" : "Phantom"}</span>
              <span className="font-mono">{shortAddr(address)}</span>
            </>
          ) : (
            "Wallet not connected. Keys stay in the extension."
          )}
        </p>
      </aside>

      <header className="sticky top-0 z-20 border-b border-line bg-bg lg:hidden">
        <div className="flex items-center justify-between px-4 py-3">
          <Link to="/" className="flex items-center gap-2">
            <Mark className="size-8" />
            <span className="font-semibold">FlowSend</span>
          </Link>
          <span className="font-mono text-xs text-muted">
            {address ? shortAddr(address) : "No wallet"}
          </span>
        </div>
        <nav className="flex gap-2 overflow-x-auto px-4 pb-3">
          {NAV.map((item) => (
            <Link
              key={item.to}
              to={item.to}
              className={cn(
                "inline-flex h-11 shrink-0 items-center rounded-full px-3 text-sm font-medium",
                active(pathname, item.to) ? "bg-primary text-ink" : "bg-surface text-fg",
              )}
            >
              {item.label}
            </Link>
          ))}
        </nav>
      </header>

      <main className="mx-auto w-full max-w-6xl px-4 py-6 sm:px-6 sm:py-8">{children}</main>
    </div>
  );
}

function itemClass(on: boolean) {
  return cn(
    "flex h-11 items-center gap-3 rounded-2xl px-3 text-sm font-medium",
    on ? "bg-primary text-ink" : "text-fg hover:bg-surface",
  );
}
