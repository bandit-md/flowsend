export const NATIVE_SOL = "So11111111111111111111111111111111111111112";
export const USDC = "EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v";
export const USDT = "Es9vMFrzaCERmJfrF4H2FYD4KCoNkY11McCe8BenwNYB";
export const MAJORS = new Set([NATIVE_SOL, USDC, USDT]);

export const SPL_PROGRAM = "TokenkegQfeZyiNwAJbNbGKPFXCWuBvf9Ss623VQ5DA";
export const TOKEN_2022 = "TokenzQdBNbLqP5VEhdkAS6EPFLC1PHnBqCXEpPxuEb";

export const BASE_FEE_LAMPORTS = 5_000;
export const EXPLORERS = ["solscan", "explorer", "solanafm"] as const;
export type ExplorerId = (typeof EXPLORERS)[number];
