import test from "node:test";
import assert from "node:assert/strict";

import { PublicKey } from "@solana/web3.js";

import { PumpTradeInstructionBuilder } from "../src/index.js";

test("builder exposes simplified public methods", () => {
  const builder = new PumpTradeInstructionBuilder({} as any);

  assert.equal(typeof builder.getTradeContext, "function");
  assert.equal(typeof builder.getMarketInfo, "function");
  assert.equal(typeof builder.createBuyInstructions, "function");
  assert.equal(typeof builder.createSellInstructions, "function");
  assert.ok(new PublicKey("11111111111111111111111111111111"));
});
