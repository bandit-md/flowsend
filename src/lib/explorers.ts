import type { ExplorerId } from "@/lib/constants";

export function txUrl(explorer: ExplorerId, signature: string) {
  if (explorer === "explorer") return `https://explorer.solana.com/tx/${signature}`;
  if (explorer === "solanafm") return `https://solana.fm/tx/${signature}`;
  return `https://solscan.io/tx/${signature}`;
}

export function addressUrl(explorer: ExplorerId, address: string) {
  if (explorer === "explorer") return `https://explorer.solana.com/address/${address}`;
  if (explorer === "solanafm") return `https://solana.fm/address/${address}`;
  return `https://solscan.io/account/${address}`;
}
