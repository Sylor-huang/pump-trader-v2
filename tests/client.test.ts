import test from "node:test";
import assert from "node:assert/strict";

import { PublicKey } from "@solana/web3.js";

import { PumpTradeInstructionBuilder } from "../src/index.js";

test("createBuyInstructions detects context, plans trade, and builds instructions", async () => {
  const builder = new PumpTradeInstructionBuilder({} as any) as any;
  builder.detectTradeContext = async () => ({
    mint: new PublicKey("11111111111111111111111111111111"),
    mode: "bonding",
    tokenProgram: new PublicKey("11111111111111111111111111111111"),
    quoteMint: new PublicKey("So11111111111111111111111111111111111111112"),
  });
  builder.planBuy = async () => ({
    context: await builder.detectTradeContext(),
    chunks: [
      {
        side: "buy",
        mode: "bonding",
        inputAmount: 1n,
        expectedOutputAmount: 2n,
        maxInputAmount: 2n,
        slippageBps: 500,
      },
    ],
  });
  builder.buildInstructions = async (plan: any) => ({ mode: plan.context.mode, chunks: [] });

  const result = await builder.createBuyInstructions({
    mint: "11111111111111111111111111111111",
    owner: new PublicKey("11111111111111111111111111111111"),
    quoteAmountIn: 1n,
  });

  assert.equal(result.mode, "bonding");
});
