import { PublicKey } from "@solana/web3.js";

export const PROGRAM_IDS = Object.freeze({
  PUMP: new PublicKey("6EF8rrecthR5Dkzon8Nwu78hRvfCKubJ14M5uBEwF6P"),
  PUMP_AMM: new PublicKey("pAMMBay6oceH9fJKBRHGP5D4bD4sWpmSwMn52FMfXEA"),
});

export const SOL_MINT = new PublicKey("So11111111111111111111111111111111111111112");

export const DEFAULT_COMPUTE_UNIT_LIMIT = 300_000;
export const DEFAULT_COMPUTE_UNIT_PRICE_MICROLAMPORTS = 0;
export const DEFAULT_SLIPPAGE_BPS = 500;
