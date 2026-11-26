import { readFileSync } from "node:fs";
import { join } from "node:path";
import type { JupToken } from "@/lib/market/types";

function readJupiterKey() {
  const fromEnv = process.env.JUPITER_API_KEY?.trim();
  if (fromEnv) return fromEnv;
  try {
    return readFileSync(join(process.cwd(), ".jupiter-key"), "utf8").trim();
  } catch {
    return "";
  }
}

export async function jupGet<T>(path: string): Promise<T> {
  const key = readJupiterKey();
  if (key) {
    const primary = await fetch(`https://api.jup.ag${path}`, {
      headers: {
        accept: "application/json",
        "x-api-key": key,
      },
      signal: AbortSignal.timeout(14_000),
    });
    if (primary.ok) return (await primary.json()) as T;
  }

  const lite = await fetch(`https://lite-api.jup.ag${path}`, {
    headers: { accept: "application/json" },
    signal: AbortSignal.timeout(14_000),
  });
  if (!lite.ok) {
    throw new Error("Jupiter is unavailable.");
  }
  return (await lite.json()) as T;
}

export async function jupPrices(ids: string[]) {
  const out: Record<string, { usdPrice?: number; priceChange24h?: number }> = {};
  const unique = [...new Set(ids.filter(Boolean))];
  for (let index = 0; index < unique.length; index += 40) {
    const chunk = unique.slice(index, index + 40);
    const data = await jupGet<Record<string, { usdPrice?: number; priceChange24h?: number }>>(
      `/price/v3?ids=${chunk.join(",")}`,
    );
    if (data && typeof data === "object") Object.assign(out, data);
  }
  return out;
}

export async function jupSearch(ids: string[]): Promise<JupToken[]> {
  const all: JupToken[] = [];
  const unique = [...new Set(ids.filter(Boolean))];
  for (let index = 0; index < unique.length; index += 40) {
    const chunk = unique.slice(index, index + 40);
    const data = await jupGet<unknown>(
      `/tokens/v2/search?query=${encodeURIComponent(chunk.join(","))}`,
    );
    if (Array.isArray(data)) all.push(...(data as JupToken[]));
  }
  return all;
}
