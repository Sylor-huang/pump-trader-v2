import { TOKEN_2022_PROGRAM_ID, TOKEN_PROGRAM_ID } from "@solana/spl-token";
import type { Connection, PublicKey } from "@solana/web3.js";

import { TradeContextDetectionError } from "../errors.js";
import type { TokenProgramInfo } from "../types.js";

export async function detectTokenProgramForMint(
  connection: Pick<Connection, "getAccountInfo">,
  mint: PublicKey,
): Promise<TokenProgramInfo> {
  const accountInfo = await connection.getAccountInfo(mint);

  if (!accountInfo) {
    throw new TradeContextDetectionError(`Mint account not found for ${mint.toBase58()}`);
  }

  if (accountInfo.owner.equals(TOKEN_2022_PROGRAM_ID)) {
    return {
      type: "TOKEN_2022_PROGRAM_ID",
      programId: TOKEN_2022_PROGRAM_ID,
    };
  }

  if (accountInfo.owner.equals(TOKEN_PROGRAM_ID)) {
    return {
      type: "TOKEN_PROGRAM_ID",
      programId: TOKEN_PROGRAM_ID,
    };
  }

  throw new TradeContextDetectionError(
    `Unsupported token program for mint ${mint.toBase58()}: ${accountInfo.owner.toBase58()}`,
  );
}
