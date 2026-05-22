import { createRequire } from "node:module";

const require = createRequire(import.meta.url);
const pumpSdk = require("@pump-fun/pump-sdk") as typeof import("@pump-fun/pump-sdk");

export const {
  OnlinePumpSdk,
  PumpSdk,
  PUMP_SDK,
  bondingCurvePda,
  getBuyTokenAmountFromSolAmount,
  getSellSolAmountFromTokenAmount,
} = pumpSdk;
