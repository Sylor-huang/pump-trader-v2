import test from "node:test";
import assert from "node:assert/strict";

import { applySlippageBps, splitAmountByMax } from "../src/index.js";

test("splitAmountByMax chunks deterministic bigint amounts", () => {
  assert.deepEqual(splitAmountByMax(10n, 4n), [4n, 4n, 2n]);
});

test("applySlippageBps inflates buy-side max input", () => {
  assert.equal(applySlippageBps(1000n, 500, "increase"), 1050n);
});
