import type { PublicKey, Signer, TransactionInstruction } from "@solana/web3.js";

export type AddressLike = PublicKey | string;
export type TradeMode = "bonding" | "amm";
export type TradeSide = "buy" | "sell";

export interface TokenProgramInfo {
  type: "TOKEN_PROGRAM_ID" | "TOKEN_2022_PROGRAM_ID";
  programId: PublicKey;
}

export interface TradeContext {
  mint: PublicKey;
  mode: TradeMode;
  tokenProgram: PublicKey;
  quoteMint: PublicKey;
  poolKey?: PublicKey;
}

export interface TradeChunkPlan {
  side: TradeSide;
  mode: TradeMode;
  inputAmount: bigint;
  expectedOutputAmount: bigint;
  slippageBps: number;
  minOutputAmount?: bigint;
  maxInputAmount?: bigint;
}

export interface TradePlan {
  context: TradeContext;
  chunks: TradeChunkPlan[];
}

export interface InstructionBundle {
  instructions: TransactionInstruction[];
  cleanupInstructions: TransactionInstruction[];
  signers: Signer[];
}

export interface BuiltTradeInstructionChunk extends InstructionBundle {
  inputAmount: bigint;
  expectedOutputAmount: bigint;
}

export interface BuiltTradeInstructions {
  mode: TradeMode;
  chunks: BuiltTradeInstructionChunk[];
}

export interface CommonTradeRequest {
  mint: AddressLike;
  slippageBps?: number;
  maxAmountPerTx?: bigint;
}

export interface BuyRequest extends CommonTradeRequest {
  quoteAmountIn: bigint;
}

export interface SellRequest extends CommonTradeRequest {
  tokenAmountIn: bigint;
}

export interface BuyInstructionsRequest extends BuyRequest {
  owner: AddressLike;
}

export interface SellInstructionsRequest extends SellRequest {
  owner: AddressLike;
}

export interface PumpTradeInstructionBuilderOptions {
  defaultSlippageBps?: number;
  defaultMaxAmountPerTx?: bigint;
}
