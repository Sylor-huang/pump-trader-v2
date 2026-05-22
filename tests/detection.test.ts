import test from "node:test";
import assert from "node:assert/strict";

import { Keypair, PublicKey } from "@solana/web3.js";

import { detectTradeContext } from "../src/index.js";

test("detectTradeContext returns bonding when bonding state exists and is incomplete", async () => {
  const mint = Keypair.generate().publicKey;
  const result = await detectTradeContext({
    connection: {} as any,
    mint,
    detectTokenProgram: async () => ({
      type: "TOKEN_PROGRAM_ID",
      programId: Keypair.generate().publicKey,
    }),
    loadBondingState: async () => ({
      complete: false,
      quoteMint: new PublicKey("So11111111111111111111111111111111111111112"),
    }),
    loadAmmPool: async () => {
      throw new Error("should not be called");
    },
  } as any);

  assert.equal(result.mode, "bonding");
});
