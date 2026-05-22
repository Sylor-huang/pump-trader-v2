import type { OnlinePumpSdk, PumpSdk } from "@pump-fun/pump-sdk";
import type { PublicKey } from "@solana/web3.js";

import { InstructionBuildError } from "../errors.js";
import type { BuiltTradeInstructions, TradePlan, TradeSide } from "../types.js";
import { bigintToBn } from "../utils/amount.js";

interface BondingBuildArgs {
  side: TradeSide;
  owner: PublicKey;
  plan: TradePlan;
  onlineSdk: Pick<OnlinePumpSdk, "fetchGlobal" | "fetchBuyState" | "fetchSellState">;
  sdk: Pick<PumpSdk, "buyInstructions" | "sellInstructions">;
}

export async function buildBondingInstructions({
  side,
  owner,
  plan,
  onlineSdk,
  sdk,
}: BondingBuildArgs): Promise<BuiltTradeInstructions> {
  try {
    const global = await onlineSdk.fetchGlobal();

    if (side === "buy") {
      const buyState = await onlineSdk.fetchBuyState(plan.context.mint, owner, plan.context.tokenProgram);
      const chunks = await Promise.all(
        plan.chunks.map(async (chunk) => ({
          instructions: await sdk.buyInstructions({
            global,
            ...buyState,
            mint: plan.context.mint,
            user: owner,
            amount: bigintToBn(chunk.expectedOutputAmount),
            solAmount: bigintToBn(chunk.inputAmount),
            slippage: chunk.slippageBps / 100,
            tokenProgram: plan.context.tokenProgram,
          }),
          cleanupInstructions: [],
          signers: [],
          inputAmount: chunk.inputAmount,
          expectedOutputAmount: chunk.expectedOutputAmount,
        })),
      );

      return { mode: "bonding", chunks };
    }

    const sellState = await onlineSdk.fetchSellState(plan.context.mint, owner, plan.context.tokenProgram);
    const chunks = await Promise.all(
      plan.chunks.map(async (chunk) => ({
        instructions: await sdk.sellInstructions({
          global,
          ...sellState,
          mint: plan.context.mint,
          user: owner,
          amount: bigintToBn(chunk.inputAmount),
          solAmount: bigintToBn(chunk.expectedOutputAmount),
          slippage: chunk.slippageBps / 100,
          tokenProgram: plan.context.tokenProgram,
          mayhemMode: sellState.bondingCurve.isMayhemMode,
          cashback: sellState.bondingCurve.isCashbackCoin,
        }),
        cleanupInstructions: [],
        signers: [],
        inputAmount: chunk.inputAmount,
        expectedOutputAmount: chunk.expectedOutputAmount,
      })),
    );

    return { mode: "bonding", chunks };
  } catch (error) {
    throw new InstructionBuildError(`Failed to build bonding ${side} instructions: ${String(error)}`);
  }
}
