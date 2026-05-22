import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";

test("README documents createBuyInstructions and createSellInstructions", () => {
  const readme = fs.readFileSync(new URL("../README.md", import.meta.url), "utf8");
  assert.match(readme, /createBuyInstructions/);
  assert.match(readme, /createSellInstructions/);
  assert.match(readme, /getMarketInfo/);
});
