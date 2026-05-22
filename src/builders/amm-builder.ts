import type { OnlinePumpAmmSdk, PumpAmmSdk } from "@pump-fun/pump-swap-sdk";
import type { PublicKey } from "@solana/web3.js";

import { InstructionBuildError } from "../errors.js";
import type { BuiltTradeInstructions, TradePlan, TradeSide } from "../types.js";
import { bigintToBn } from "../utils/amount.js";

interface AmmBuildArgs {
  side: TradeSide;
  owner: PublicKey;
  plan: TradePlan;
  onlineSdk: Pick<OnlinePumpAmmSdk, "swapSolanaState">;
  sdk: Pick<PumpAmmSdk, "buyQuoteInput" | "sellBaseInput">;
}

export async function buildAmmInstructions({
  side,
  owner,
  plan,
  onlineSdk,
  sdk,
}: AmmBuildArgs): Promise<BuiltTradeInstructions> {
  try {
    if (!plan.context.poolKey) {
      throw new InstructionBuildError("AMM plan is missing poolKey");
    }

    const swapState = await onlineSdk.swapSolanaState(plan.context.poolKey, owner);
    const chunks = await Promise.all(
      plan.chunks.map(async (chunk) => ({
        instructions:
          side === "buy"
            ? await sdk.buyQuoteInput(
                swapState,
                bigintToBn(chunk.inputAmount),
                chunk.slippageBps / 100,
              )
            : await sdk.sellBaseInput(
                swapState,
                bigintToBn(chunk.inputAmount),
                chunk.slippageBps / 100,
              ),
        cleanupInstructions: [],
        signers: [],
        inputAmount: chunk.inputAmount,
        expectedOutputAmount: chunk.expectedOutputAmount,
      })),
    );

    return { mode: "amm", chunks };
  } catch (error) {
    throw new InstructionBuildError(`Failed to build AMM ${side} instructions: ${String(error)}`);
  }
}
