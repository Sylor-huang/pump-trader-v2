import type { BuyRequest, TradeContext, TradePlan } from "../types.js";
import { DEFAULT_SLIPPAGE_BPS } from "../constants.js";
import { InvalidTradeInputError } from "../errors.js";
import { splitAmountByMax } from "./chunking.js";
import { applySlippageBps } from "./slippage.js";

interface BuyPlanDependencies {
  context: TradeContext;
  quoteBuyOut: (amountIn: bigint) => Promise<{ expectedOutputAmount: bigint }>;
}

export async function createBuyPlan(
  request: BuyRequest,
  { context, quoteBuyOut }: BuyPlanDependencies,
): Promise<TradePlan> {
  if (request.quoteAmountIn <= 0n) {
    throw new InvalidTradeInputError("quoteAmountIn must be greater than zero");
  }

  const slippageBps = request.slippageBps ?? DEFAULT_SLIPPAGE_BPS;
  const maxAmountPerTx = request.maxAmountPerTx ?? request.quoteAmountIn;
  const chunks = splitAmountByMax(request.quoteAmountIn, maxAmountPerTx);

  return {
    context,
    chunks: await Promise.all(
      chunks.map(async (inputAmount) => {
        const { expectedOutputAmount } = await quoteBuyOut(inputAmount);
        return {
          side: "buy" as const,
          mode: context.mode,
          inputAmount,
          expectedOutputAmount,
          slippageBps,
          maxInputAmount: applySlippageBps(inputAmount, slippageBps, "increase"),
        };
      }),
    ),
  };
}
