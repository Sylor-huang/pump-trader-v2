import test from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import path from "node:path";
import { pathToFileURL } from "node:url";

const packageJsonPath = new URL("../package.json", import.meta.url);
const packageJson = JSON.parse(await readFile(packageJsonPath, "utf8")) as {
  main: string;
  files?: string[];
  scripts?: Record<string, string>;
};

test("package metadata points packaging to the built dist entry", () => {
  assert.equal(packageJson.main, "./dist/index.js");
  assert.deepEqual(packageJson.files, ["dist"]);
  assert.equal(packageJson.scripts?.prepack, "npm run build");
});

test("built package entry exports the main public API surface", async () => {
  const entryPath = path.resolve(path.dirname(packageJsonPath.pathname), packageJson.main);
  const mod = (await import(pathToFileURL(entryPath).href)) as Record<string, unknown>;

  assert.equal(typeof mod.PumpTradeInstructionBuilder, "function");
  assert.equal(typeof mod.detectTradeContext, "function");
  assert.equal(typeof mod.detectTokenProgramForMint, "function");
  assert.equal(typeof mod.splitAmountByMax, "function");
});
