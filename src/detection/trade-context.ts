import type { Connection, PublicKey } from "@solana/web3.js";

import { SOL_MINT } from "../constants.js";
import { UnsupportedPumpMintError } from "../errors.js";
import type { TokenProgramInfo, TradeContext } from "../types.js";
import { toPublicKey } from "../utils/amount.js";
import { loadAmmPool } from "./amm.js";
import { loadBondingCurveState } from "./bonding.js";
import { detectTokenProgramForMint } from "../utils/token-program.js";

interface DetectTradeContextArgs {
  connection: Pick<Connection, "getAccountInfo">;
  mint: PublicKey | string;
  detectTokenProgram?: typeof detectTokenProgramForMint;
  loadBondingState?: typeof loadBondingCurveState;
  loadAmmPool?: typeof loadAmmPool;
}

export async function detectTradeContext({
  connection,
  mint,
  detectTokenProgram = detectTokenProgramForMint,
  loadBondingState = loadBondingCurveState,
  loadAmmPool: loadAmmPoolState = loadAmmPool,
}: DetectTradeContextArgs): Promise<TradeContext> {
  const mintKey = toPublicKey(mint);
  const tokenProgram: TokenProgramInfo = await detectTokenProgram(connection, mintKey);
  const bondingCurve = await loadBondingState(connection, mintKey);

  if (bondingCurve && !bondingCurve.complete) {
    return {
      mint: mintKey,
      mode: "bonding",
      tokenProgram: tokenProgram.programId,
      quoteMint: bondingCurve.quoteMint ?? SOL_MINT,
    };
  }

  const quoteMint = bondingCurve?.quoteMint ?? SOL_MINT;
  const { poolKey, pool } = await loadAmmPoolState(connection, mintKey, quoteMint);

  if (bondingCurve?.complete || pool) {
    return {
      mint: mintKey,
      mode: "amm",
      tokenProgram: tokenProgram.programId,
      quoteMint,
      poolKey,
    };
  }

  throw new UnsupportedPumpMintError(`Unable to find Pump market for mint ${mintKey.toBase58()}`);
}
