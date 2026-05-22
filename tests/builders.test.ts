import test from "node:test";
import assert from "node:assert/strict";

import { PublicKey, TransactionInstruction } from "@solana/web3.js";

import { buildAmmInstructions, buildBondingInstructions } from "../src/index.js";

test("buildBondingInstructions delegates to PumpSdk buyInstructions", async () => {
  const owner = new PublicKey("11111111111111111111111111111111");
  const fakeIx = new TransactionInstruction({ keys: [], programId: owner });

  const result = await buildBondingInstructions({
    side: "buy",
    owner,
    plan: {
      context: {
        mint: owner,
        mode: "bonding",
        tokenProgram: owner,
        quoteMint: owner,
      },
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
    },
    onlineSdk: {
      fetchGlobal: async () => ({}) as any,
      fetchBuyState: async () => ({
        bondingCurveAccountInfo: {} as any,
        bondingCurve: {} as any,
        associatedUserAccountInfo: null,
      }),
    } as any,
    sdk: {
      buyInstructions: async () => [fakeIx],
    } as any,
  });

  assert.equal(result.chunks[0].instructions[0], fakeIx);
});

test("buildAmmInstructions delegates to swap sdk buyQuoteInput", async () => {
  const owner = new PublicKey("11111111111111111111111111111111");
  const swapIx = new TransactionInstruction({ keys: [], programId: owner });

  const result = await buildAmmInstructions({
    side: "buy",
    owner,
    plan: {
      context: {
        mint: owner,
        mode: "amm",
        tokenProgram: owner,
        quoteMint: owner,
        poolKey: owner,
      },
      chunks: [
        {
          side: "buy",
          mode: "amm",
          inputAmount: 1n,
          expectedOutputAmount: 2n,
          maxInputAmount: 2n,
          slippageBps: 500,
        },
      ],
    },
    onlineSdk: {
      swapSolanaState: async () => ({}) as any,
    } as any,
    sdk: {
      buyQuoteInput: async () => [swapIx],
    } as any,
  });

  assert.equal(result.chunks[0].instructions[0], swapIx);
});
