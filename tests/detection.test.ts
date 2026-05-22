import test from "node:test";
import assert from "node:assert/strict";

import { detectTokenProgramForMint } from "../src/index.js";

test("detectTokenProgramForMint throws when mint account is missing", async () => {
  await assert.rejects(
    () =>
      detectTokenProgramForMint(
        {
          getAccountInfo: async () => null,
        } as any,
        {
          toBase58: () => "missing-mint",
        } as any,
      ),
    /Mint account not found/,
  );
});
