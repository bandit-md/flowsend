import { createContext, useContext, useEffect, useMemo, useState, type ReactNode } from "react";
import { toast } from "sonner";
import { useSession } from "@/lib/stores";
import { readProviders, type InjectedSolana, type WalletId } from "@/lib/wallet/detect";

type WalletContextValue = {
  ready: boolean;
  installed: Record<WalletId, boolean>;
  provider: InjectedSolana | null;
  busy: boolean;
  connect: (id: WalletId) => Promise<void>;
  disconnect: () => Promise<void>;
};

const WalletContext = createContext<WalletContextValue | null>(null);

export function WalletProvider({ children }: { children: ReactNode }) {
  const setSession = useSession((state) => state.setSession);
  const clear = useSession((state) => state.clear);
  const [ready, setReady] = useState(false);
  const [installed, setInstalled] = useState<Record<WalletId, boolean>>({
    phantom: false,
    solflare: false,
  });
  const [provider, setProvider] = useState<InjectedSolana | null>(null);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    let cancel = false;
    void (async () => {
      await useSession.persist.rehydrate();
      if (cancel) return;
      const providers = readProviders();
      setInstalled({ phantom: Boolean(providers.phantom), solflare: Boolean(providers.solflare) });
      const saved = useSession.getState().wallet;
      const injected = saved ? providers[saved] : null;
      if (saved && injected) {
        try {
          const result = await injected.connect({ onlyIfTrusted: true });
          const address = result.publicKey?.toString() ?? injected.publicKey?.toString();
          if (address) {
            useSession.getState().setSession(address, saved);
            setProvider(injected);
          }
        } catch {
          // A locked wallet should not block the rest of the app.
        }
      }
      if (!cancel) setReady(true);
    })();
    return () => {
      cancel = true;
    };
  }, []);

  useEffect(() => {
    if (!provider) return;
    const onAccount = (key: unknown) => {
      const wallet = useSession.getState().wallet;
      const address =
        key && typeof key === "object" && "toString" in key ? String(key) : "";
      if (!wallet || !address || address === "null") {
        clear();
        setProvider(null);
        return;
      }
      setSession(address, wallet);
    };
    const onDisconnect = () => {
      clear();
      setProvider(null);
    };
    provider.on?.("accountChanged", onAccount);
    provider.on?.("disconnect", onDisconnect);
    return () => {
      provider.off?.("accountChanged", onAccount);
      provider.off?.("disconnect", onDisconnect);
    };
  }, [provider, clear, setSession]);

  const value = useMemo<WalletContextValue>(
    () => ({
      ready,
      installed,
      provider,
      busy,
      connect: async (id) => {
        const found = readProviders()[id];
        if (!found) {
          toast.error(
            id === "phantom"
              ? "Phantom is not installed in this browser."
              : "Solflare is not installed in this browser.",
          );
          return;
        }
        setBusy(true);
        try {
          const result = await found.connect();
          const address = result.publicKey?.toString() ?? found.publicKey?.toString();
          if (!address) throw new Error("The wallet did not return an address.");
          setSession(address, id);
          setProvider(found);
          toast.success(id === "phantom" ? "Phantom connected" : "Solflare connected");
        } catch (error) {
          toast.error(error instanceof Error ? error.message : "The connection was rejected.");
        } finally {
          setBusy(false);
        }
      },
      disconnect: async () => {
        try {
          await provider?.disconnect();
        } catch {
          // The extension may already be closed.
        }
        clear();
        setProvider(null);
      },
    }),
    [ready, installed, provider, busy, setSession, clear],
  );

  return <WalletContext.Provider value={value}>{children}</WalletContext.Provider>;
}

export function useWallet() {
  const value = useContext(WalletContext);
  if (!value) throw new Error("Wallet controls are unavailable.");
  return value;
}
