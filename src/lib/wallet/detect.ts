export type WalletId = "phantom" | "solflare";

export type InjectedSolana = {
  isPhantom?: boolean;
  isSolflare?: boolean;
  publicKey?: { toString(): string } | null;
  connect: (opts?: { onlyIfTrusted?: boolean }) => Promise<{ publicKey?: { toString(): string } }>;
  disconnect: () => Promise<void>;
  signAndSendTransaction: (tx: unknown) => Promise<{ signature: string | Uint8Array }>;
  on?: (event: string, cb: (...args: unknown[]) => void) => void;
  off?: (event: string, cb: (...args: unknown[]) => void) => void;
};

type WalletWindow = Window & {
  phantom?: { solana?: InjectedSolana };
  solflare?: InjectedSolana;
  solana?: InjectedSolana;
};

export function readProviders() {
  if (typeof window === "undefined") {
    return { phantom: null, solflare: null };
  }
  const win = window as WalletWindow;
  const phantom = win.phantom?.solana?.isPhantom
    ? win.phantom.solana
    : win.solana?.isPhantom
      ? win.solana
      : null;
  const solflare = win.solflare?.isSolflare ? win.solflare : null;
  return { phantom, solflare };
}

export async function signatureText(signature: string | Uint8Array) {
  if (typeof signature === "string") return signature;
  const { default: bs58 } = await import("bs58");
  return bs58.encode(signature);
}
