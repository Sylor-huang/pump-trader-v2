import { InvalidTradeInputError } from "../errors.js";

export function applySlippageBps(
  amount: bigint,
  bps: number,
  direction: "increase" | "decrease",
): bigint {
  if (bps < 0) {
    throw new InvalidTradeInputError("slippageBps must be non-negative");
  }

  const slippage = (amount * BigInt(bps)) / 10_000n;
  return direction === "increase" ? amount + slippage : amount - slippage;
}
