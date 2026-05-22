import type { Pool } from "@pump-fun/pump-swap-sdk";
import type { Connection, PublicKey } from "@solana/web3.js";

import { SOL_MINT } from "../constants.js";
import { PUMP_AMM_SDK, canonicalPumpPoolPda } from "../sdk/pump-swap-sdk.js";

export async function loadAmmPool(
  connection: Pick<Connection, "getAccountInfo">,
  mint: PublicKey,
  quoteMint: PublicKey = SOL_MINT,
): Promise<{ poolKey: PublicKey; pool: Pool | null }> {
  const poolKey = canonicalPumpPoolPda(mint, quoteMint);
  const accountInfo = await connection.getAccountInfo(poolKey);

  if (!accountInfo) {
    return { poolKey, pool: null };
  }

  return {
    poolKey,
    pool: PUMP_AMM_SDK.decodePoolNullable(accountInfo),
  };
}
