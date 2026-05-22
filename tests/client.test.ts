import test from "node:test";
import assert from "node:assert/strict";

import { PumpTradeInstructionBuilder } from "../src/index.js";

test("builder constructor accepts options", () => {
  const builder = new PumpTradeInstructionBuilder({} as any, {
    defaultSlippageBps: 700,
    defaultMaxAmountPerTx: 10n,
  });

  assert.equal(typeof builder.createBuyInstructions, "function");
  assert.equal(typeof builder.createSellInstructions, "function");
});
