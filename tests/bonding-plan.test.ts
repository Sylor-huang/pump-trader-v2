import test from "node:test";
import assert from "node:assert/strict";

import { applySlippageBps, splitAmountByMax } from "../src/index.js";

test("splitAmountByMax creates deterministic chunks", () => {
  assert.deepEqual(splitAmountByMax(10n, 4n), [4n, 4n, 2n]);
});

test("applySlippageBps increases buy input by bps", () => {
  assert.equal(applySlippageBps(1000n, 500, "increase"), 1050n);
});
