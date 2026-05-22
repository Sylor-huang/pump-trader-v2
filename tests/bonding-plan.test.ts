import test from "node:test";
import assert from "node:assert/strict";

import { Keypair } from "@solana/web3.js";

import { createBuyPlan } from "../src/index.js";

test("createBuyPlan creates chunk metadata with max input bounds", async () => {
  const mint = Keypair.generate().publicKey;
  const programId = Keypair.generate().publicKey;
  const plan = await createBuyPlan(
    {
      mint,
      quoteAmountIn: 10n,
      slippageBps: 500,
      maxAmountPerTx: 4n,
    },
    {
      context: {
        mint,
        mode: "bonding",
        tokenProgram: programId,
        quoteMint: Keypair.generate().publicKey,
      },
      quoteBuyOut: async (amount: bigint) => ({ expectedOutputAmount: amount * 2n }),
    },
  );

  assert.equal(plan.chunks.length, 3);
  assert.equal(plan.chunks[0].maxInputAmount, 4n);
});
