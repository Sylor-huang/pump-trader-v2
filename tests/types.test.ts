import test from "node:test";
import assert from "node:assert/strict";

import { PROGRAM_IDS, SOL_MINT } from "../src/index.js";

test("exports core Pump constants", () => {
  assert.equal(PROGRAM_IDS.PUMP.toBase58(), "6EF8rrecthR5Dkzon8Nwu78hRvfCKubJ14M5uBEwF6P");
  assert.equal(PROGRAM_IDS.PUMP_AMM.toBase58(), "pAMMBay6oceH9fJKBRHGP5D4bD4sWpmSwMn52FMfXEA");
  assert.equal(SOL_MINT.toBase58(), "So11111111111111111111111111111111111111112");
});
