import { create } from "zustand";
import { persist } from "zustand/middleware";
import type { ExplorerId } from "@/lib/constants";

type Settings = {
  lite: boolean;
  hideBalances: boolean;
  explorer: ExplorerId;
  setLite: (lite: boolean) => void;
  setHideBalances: (hide: boolean) => void;
  setExplorer: (explorer: ExplorerId) => void;
};

export const useSettings = create<Settings>()(
  persist(
    (set) => ({
      lite: false,
      hideBalances: false,
      explorer: "solscan",
      setLite: (lite) => set({ lite }),
      setHideBalances: (hideBalances) => set({ hideBalances }),
      setExplorer: (explorer) => set({ explorer }),
    }),
    { name: "flowsend-settings", skipHydration: true },
  ),
);

type Session = {
  address: string | null;
  wallet: "phantom" | "solflare" | null;
  setSession: (address: string, wallet: "phantom" | "solflare") => void;
  clear: () => void;
};

export const useSession = create<Session>()(
  persist(
    (set) => ({
      address: null,
      wallet: null,
      setSession: (address, wallet) => set({ address, wallet }),
      clear: () => set({ address: null, wallet: null }),
    }),
    { name: "flowsend-session", skipHydration: true },
  ),
);

export type LocalActivity = {
  signature: string;
  at: number;
  asset: string;
  amount: string;
  to: string;
  networkFeeLamports: number;
  ataRentLamports: number;
};

type ActivityState = {
  items: LocalActivity[];
  add: (item: LocalActivity) => void;
  clear: () => void;
};

export const useActivity = create<ActivityState>()(
  persist(
    (set) => ({
      items: [],
      add: (item) => set((state) => ({ items: [item, ...state.items].slice(0, 40) })),
      clear: () => set({ items: [] }),
    }),
    { name: "flowsend-activity", skipHydration: true },
  ),
);
