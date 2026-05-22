import test from "node:test";
import assert from "node:assert/strict";

import { TOKEN_2022_PROGRAM_ID } from "@solana/spl-token";
import { Keypair } from "@solana/web3.js";

import { detectTokenProgramForMint } from "../src/index.js";

test("detectTokenProgramForMint prefers token-2022 when account owner matches", async () => {
  const mint = Keypair.generate().publicKey;
  const result = await detectTokenProgramForMint(
    {
      getAccountInfo: async () => ({
        owner: TOKEN_2022_PROGRAM_ID,
      }),
    } as any,
    mint,
  );

  assert.equal(result.programId.toBase58(), TOKEN_2022_PROGRAM_ID.toBase58());
});
