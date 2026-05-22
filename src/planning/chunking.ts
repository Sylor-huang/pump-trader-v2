import { InvalidTradeInputError } from "../errors.js";

export function splitAmountByMax(total: bigint, maxPerChunk: bigint): bigint[] {
  if (total <= 0n) {
    throw new InvalidTradeInputError("amount must be greater than zero");
  }

  if (maxPerChunk <= 0n) {
    throw new InvalidTradeInputError("maxAmountPerTx must be greater than zero");
  }

  if (total <= maxPerChunk) {
    return [total];
  }

  const chunks: bigint[] = [];
  let remaining = total;

  while (remaining > 0n) {
    const chunk = remaining > maxPerChunk ? maxPerChunk : remaining;
    chunks.push(chunk);
    remaining -= chunk;
  }

  return chunks;
}
