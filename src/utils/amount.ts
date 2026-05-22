import BN from "bn.js";
import { PublicKey } from "@solana/web3.js";

import type { AddressLike } from "../types.js";

export function toPublicKey(value: AddressLike): PublicKey {
  return value instanceof PublicKey ? value : new PublicKey(value);
}

export function bigintToBn(value: bigint): BN {
  return new BN(value.toString());
}

export function bnToBigint(value: BN): bigint {
  return BigInt(value.toString());
}
