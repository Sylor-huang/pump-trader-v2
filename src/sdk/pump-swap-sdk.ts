import { createRequire } from "node:module";

const require = createRequire(import.meta.url);
const pumpSwapSdk = require("@pump-fun/pump-swap-sdk") as typeof import("@pump-fun/pump-swap-sdk");

export const {
  OnlinePumpAmmSdk,
  PumpAmmSdk,
  PUMP_AMM_SDK,
  canonicalPumpPoolPda,
  buyQuoteInput,
  sellBaseInput,
} = pumpSwapSdk;
