import type { BondingCurve } from "@pump-fun/pump-sdk";
import type { Connection, PublicKey } from "@solana/web3.js";

import { PUMP_SDK, bondingCurvePda } from "../sdk/pump-sdk.js";

export async function loadBondingCurveState(
  connection: Pick<Connection, "getAccountInfo">,
  mint: PublicKey,
): Promise<BondingCurve | null> {
  const accountInfo = await connection.getAccountInfo(bondingCurvePda(mint));

  if (!accountInfo) {
    return null;
  }

  return PUMP_SDK.decodeBondingCurveNullable(accountInfo);
}
