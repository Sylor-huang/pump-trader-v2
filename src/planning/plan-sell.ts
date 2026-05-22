import type { SellRequest, TradeContext, TradePlan } from "../types.js";
import { DEFAULT_SLIPPAGE_BPS } from "../constants.js";
import { InvalidTradeInputError } from "../errors.js";
import { splitAmountByMax } from "./chunking.js";
import { applySlippageBps } from "./slippage.js";

interface SellPlanDependencies {
  context: TradeContext;
  quoteSellOut: (amountIn: bigint) => Promise<{ expectedOutputAmount: bigint }>;
}

export async function createSellPlan(
  request: SellRequest,
  { context, quoteSellOut }: SellPlanDependencies,
): Promise<TradePlan> {
  if (request.tokenAmountIn <= 0n) {
    throw new InvalidTradeInputError("tokenAmountIn must be greater than zero");
  }

  const slippageBps = request.slippageBps ?? DEFAULT_SLIPPAGE_BPS;
  const maxAmountPerTx = request.maxAmountPerTx ?? request.tokenAmountIn;
  const chunks = splitAmountByMax(request.tokenAmountIn, maxAmountPerTx);

  return {
    context,
    chunks: await Promise.all(
      chunks.map(async (inputAmount) => {
        const { expectedOutputAmount } = await quoteSellOut(inputAmount);
        return {
          side: "sell" as const,
          mode: context.mode,
          inputAmount,
          expectedOutputAmount,
          slippageBps,
          minOutputAmount: applySlippageBps(expectedOutputAmount, slippageBps, "decrease"),
        };
      }),
    ),
  };
}
