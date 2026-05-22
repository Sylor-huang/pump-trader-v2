import { createRequire } from "node:module";

import { TOKEN_2022_PROGRAM_ID, TOKEN_PROGRAM_ID } from "@solana/spl-token";
import type { Connection as ConnectionType, PublicKey, Signer, TransactionInstruction } from "@solana/web3.js";
import { Connection, PublicKey as Web3PublicKey } from "@solana/web3.js";
import BN from "bn.js";

const require = createRequire(import.meta.url);
const pumpSdk = require("@pump-fun/pump-sdk") as typeof import("@pump-fun/pump-sdk");
const pumpSwapSdk = require("@pump-fun/pump-swap-sdk") as typeof import("@pump-fun/pump-swap-sdk");

const {
  OnlinePumpSdk,
  PumpSdk,
  PUMP_SDK,
  bondingCurvePda,
  getBuyTokenAmountFromSolAmount,
  getSellSolAmountFromTokenAmount,
} = pumpSdk;

const {
  OnlinePumpAmmSdk,
  PumpAmmSdk,
  PUMP_AMM_SDK,
  canonicalPumpPoolPda,
  buyQuoteInput,
  sellBaseInput,
} = pumpSwapSdk;

export const PROGRAM_IDS = Object.freeze({
  PUMP: new Web3PublicKey("6EF8rrecthR5Dkzon8Nwu78hRvfCKubJ14M5uBEwF6P"),
  PUMP_AMM: new Web3PublicKey("pAMMBay6oceH9fJKBRHGP5D4bD4sWpmSwMn52FMfXEA"),
});

export const SOL_MINT = new Web3PublicKey("So11111111111111111111111111111111111111112");
export const DEFAULT_SLIPPAGE_BPS = 500;

export type AddressLike = PublicKey | string;
export type TradeMode = "bonding" | "amm";
export type TradeSide = "buy" | "sell";

export interface TokenProgramInfo {
  type: "TOKEN_PROGRAM_ID" | "TOKEN_2022_PROGRAM_ID";
  programId: PublicKey;
}

export interface PumpTradeInstructionBuilderOptions {
  defaultSlippageBps?: number;
  defaultMaxAmountPerTx?: bigint;
  commitment?: ConstructorParameters<typeof Connection>[1];
}

export interface CommonTradeRequest {
  mint: AddressLike;
  slippageBps?: number;
  maxAmountPerTx?: bigint;
}

export interface BuyInstructionsRequest extends CommonTradeRequest {
  owner: AddressLike;
  quoteAmountIn: bigint;
}

export interface SellInstructionsRequest extends CommonTradeRequest {
  owner: AddressLike;
  tokenAmountIn: bigint;
}

export interface TradeContext {
  mint: PublicKey;
  mode: TradeMode;
  tokenProgram: PublicKey;
  quoteMint: PublicKey;
  poolKey?: PublicKey;
}

export interface InstructionChunk {
  instructions: TransactionInstruction[];
  cleanupInstructions: TransactionInstruction[];
  signers: Signer[];
  inputAmount: bigint;
  expectedOutputAmount: bigint;
}

export interface BuiltTradeInstructions {
  mode: TradeMode;
  chunks: InstructionChunk[];
}

export interface MarketInfo {
  mint: PublicKey;
  mode: TradeMode;
  tokenProgram: PublicKey;
  quoteMint: PublicKey;
  poolKey?: PublicKey;
  tokenAmount: bigint;
  solAmount: bigint;
  virtualTokenAmount?: bigint;
  virtualSolAmount?: bigint;
}

function toPublicKey(value: AddressLike): PublicKey {
  return value instanceof Web3PublicKey ? value : new Web3PublicKey(value);
}

function bigintToBn(value: bigint): BN {
  return new BN(value.toString());
}

function bnToBigint(value: BN): bigint {
  return BigInt(value.toString());
}

export function splitAmountByMax(total: bigint, maxPerChunk: bigint): bigint[] {
  if (total <= 0n) {
    throw new Error("amount must be greater than zero");
  }

  if (maxPerChunk <= 0n) {
    throw new Error("maxAmountPerTx must be greater than zero");
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

export function applySlippageBps(
  amount: bigint,
  bps: number,
  direction: "increase" | "decrease",
): bigint {
  const slippage = (amount * BigInt(bps)) / 10_000n;
  return direction === "increase" ? amount + slippage : amount - slippage;
}

export async function detectTokenProgramForMint(
  connection: Pick<ConnectionType, "getAccountInfo">,
  mint: PublicKey,
): Promise<TokenProgramInfo> {
  const accountInfo = await connection.getAccountInfo(mint);

  if (!accountInfo) {
    throw new Error(`Mint account not found for ${mint.toBase58()}`);
  }

  if (accountInfo.owner.equals(TOKEN_2022_PROGRAM_ID)) {
    return { type: "TOKEN_2022_PROGRAM_ID", programId: TOKEN_2022_PROGRAM_ID };
  }

  if (accountInfo.owner.equals(TOKEN_PROGRAM_ID)) {
    return { type: "TOKEN_PROGRAM_ID", programId: TOKEN_PROGRAM_ID };
  }

  throw new Error(`Unsupported token program for mint ${mint.toBase58()}`);
}

async function loadBondingCurveState(
  connection: Pick<ConnectionType, "getAccountInfo">,
  mint: PublicKey,
) {
  const accountInfo = await connection.getAccountInfo(bondingCurvePda(mint));
  if (!accountInfo) {
    return null;
  }
  return PUMP_SDK.decodeBondingCurveNullable(accountInfo);
}

async function loadAmmPool(
  connection: Pick<ConnectionType, "getAccountInfo">,
  mint: PublicKey,
  quoteMint: PublicKey = SOL_MINT,
) {
  const poolKey = canonicalPumpPoolPda(mint, quoteMint);
  const accountInfo = await connection.getAccountInfo(poolKey);
  if (!accountInfo) {
    return { poolKey, pool: null as import("@pump-fun/pump-swap-sdk").Pool | null };
  }

  return {
    poolKey,
    pool: PUMP_AMM_SDK.decodePoolNullable(accountInfo),
  };
}

export async function detectTradeContext(args: {
  connection: Pick<ConnectionType, "getAccountInfo">;
  mint: AddressLike;
}): Promise<TradeContext> {
  const mint = toPublicKey(args.mint);
  const tokenProgram = await detectTokenProgramForMint(args.connection, mint);
  const bondingCurve = await loadBondingCurveState(args.connection, mint);

  if (bondingCurve && !bondingCurve.complete) {
    return {
      mint,
      mode: "bonding",
      tokenProgram: tokenProgram.programId,
      quoteMint: bondingCurve.quoteMint ?? SOL_MINT,
    };
  }

  const quoteMint = bondingCurve?.quoteMint ?? SOL_MINT;
  const { poolKey, pool } = await loadAmmPool(args.connection, mint, quoteMint);

  if (bondingCurve?.complete || pool) {
    return {
      mint,
      mode: "amm",
      tokenProgram: tokenProgram.programId,
      quoteMint,
      poolKey,
    };
  }

  throw new Error(`Unable to determine Pump market for ${mint.toBase58()}`);
}

export class PumpTradeInstructionBuilder {
  private readonly connection: ConnectionType;
  private readonly onlinePumpSdk: import("@pump-fun/pump-sdk").OnlinePumpSdk;
  private readonly offlinePumpSdk: import("@pump-fun/pump-sdk").PumpSdk;
  private readonly onlinePumpAmmSdk: import("@pump-fun/pump-swap-sdk").OnlinePumpAmmSdk;
  private readonly offlinePumpAmmSdk: import("@pump-fun/pump-swap-sdk").PumpAmmSdk;
  private readonly options: PumpTradeInstructionBuilderOptions;

  constructor(connection: ConnectionType | string, options: PumpTradeInstructionBuilderOptions = {}) {
    this.connection =
      typeof connection === "string"
        ? new Connection(connection, options.commitment ?? "confirmed")
        : connection;
    this.onlinePumpSdk = new OnlinePumpSdk(this.connection);
    this.offlinePumpSdk = new PumpSdk();
    this.onlinePumpAmmSdk = new OnlinePumpAmmSdk(this.connection);
    this.offlinePumpAmmSdk = new PumpAmmSdk();
    this.options = options;
  }

  async getTradeContext(mint: AddressLike): Promise<TradeContext> {
    return detectTradeContext({
      connection: this.connection,
      mint,
    });
  }

  async getMarketInfo(mintLike: AddressLike): Promise<MarketInfo> {
    const context = await this.getTradeContext(mintLike);

    if (context.mode === "bonding") {
      const bondingCurve = await loadBondingCurveState(this.connection, context.mint);
      if (!bondingCurve) {
        throw new Error(`Bonding curve not found for ${context.mint.toBase58()}`);
      }

      return {
        mint: context.mint,
        mode: "bonding",
        tokenProgram: context.tokenProgram,
        quoteMint: context.quoteMint,
        tokenAmount: bnToBigint(bondingCurve.realTokenReserves),
        solAmount: bnToBigint(bondingCurve.realQuoteReserves),
        virtualTokenAmount: bnToBigint(bondingCurve.virtualTokenReserves),
        virtualSolAmount: bnToBigint(bondingCurve.virtualQuoteReserves),
      };
    }

    const { pool } = await loadAmmPool(this.connection, context.mint, context.quoteMint);
    if (!pool) {
      throw new Error(`AMM pool not found for ${context.mint.toBase58()}`);
    }

    const [baseBalance, quoteBalance] = await Promise.all([
      this.connection.getTokenAccountBalance(pool.poolBaseTokenAccount),
      this.connection.getTokenAccountBalance(pool.poolQuoteTokenAccount),
    ]);

    return {
      mint: context.mint,
      mode: "amm",
      tokenProgram: context.tokenProgram,
      quoteMint: context.quoteMint,
      poolKey: context.poolKey,
      tokenAmount: BigInt(baseBalance.value.amount),
      solAmount: BigInt(quoteBalance.value.amount),
    };
  }

  async createBuyInstructions(request: BuyInstructionsRequest): Promise<BuiltTradeInstructions> {
    const owner = toPublicKey(request.owner);
    const context = await this.getTradeContext(request.mint);
    const slippageBps = request.slippageBps ?? this.options.defaultSlippageBps ?? DEFAULT_SLIPPAGE_BPS;
    const maxAmountPerTx = request.maxAmountPerTx ?? this.options.defaultMaxAmountPerTx ?? request.quoteAmountIn;
    const chunks = splitAmountByMax(request.quoteAmountIn, maxAmountPerTx);

    if (context.mode === "bonding") {
      const global = await this.onlinePumpSdk.fetchGlobal();
      const feeConfig = await this.onlinePumpSdk.fetchFeeConfig();
      const buyState = await this.onlinePumpSdk.fetchBuyState(context.mint, owner, context.tokenProgram);
      const bondingCurve = await loadBondingCurveState(this.connection, context.mint);

      if (!bondingCurve) {
        throw new Error(`Bonding curve not found for ${context.mint.toBase58()}`);
      }

      return {
        mode: "bonding",
        chunks: await Promise.all(
          chunks.map(async (quoteAmountIn) => {
            const expectedOutputAmount = bnToBigint(
              getBuyTokenAmountFromSolAmount({
                global,
                feeConfig,
                mintSupply: bondingCurve.tokenTotalSupply,
                bondingCurve,
                amount: bigintToBn(quoteAmountIn),
                quoteMint: context.quoteMint,
              }),
            );

            return {
              instructions: await this.offlinePumpSdk.buyInstructions({
                global,
                ...buyState,
                mint: context.mint,
                user: owner,
                solAmount: bigintToBn(quoteAmountIn),
                amount: bigintToBn(expectedOutputAmount),
                slippage: slippageBps / 100,
                tokenProgram: context.tokenProgram,
              }),
              cleanupInstructions: [],
              signers: [],
              inputAmount: quoteAmountIn,
              expectedOutputAmount,
            };
          }),
        ),
      };
    }

    const swapState = await this.onlinePumpAmmSdk.swapSolanaState(context.poolKey!, owner);
    return {
      mode: "amm",
      chunks: await Promise.all(
        chunks.map(async (quoteAmountIn) => ({
          instructions: await this.offlinePumpAmmSdk.buyQuoteInput(
            swapState,
            bigintToBn(quoteAmountIn),
            slippageBps / 100,
          ),
          cleanupInstructions: [],
          signers: [],
          inputAmount: quoteAmountIn,
          expectedOutputAmount: bnToBigint(
            buyQuoteInput({
              quote: bigintToBn(quoteAmountIn),
              slippage: slippageBps / 100,
              baseReserve: swapState.poolBaseAmount,
              quoteReserve: swapState.poolQuoteAmount,
              globalConfig: swapState.globalConfig,
              baseMintAccount: swapState.baseMintAccount,
              baseMint: swapState.baseMint,
              coinCreator: swapState.pool.coinCreator,
              creator: swapState.pool.creator,
              feeConfig: swapState.feeConfig,
            }).base,
          ),
        })),
      ),
    };
  }

  async createSellInstructions(request: SellInstructionsRequest): Promise<BuiltTradeInstructions> {
    const owner = toPublicKey(request.owner);
    const context = await this.getTradeContext(request.mint);
    const slippageBps = request.slippageBps ?? this.options.defaultSlippageBps ?? DEFAULT_SLIPPAGE_BPS;
    const maxAmountPerTx = request.maxAmountPerTx ?? this.options.defaultMaxAmountPerTx ?? request.tokenAmountIn;
    const chunks = splitAmountByMax(request.tokenAmountIn, maxAmountPerTx);

    if (context.mode === "bonding") {
      const global = await this.onlinePumpSdk.fetchGlobal();
      const feeConfig = await this.onlinePumpSdk.fetchFeeConfig();
      const sellState = await this.onlinePumpSdk.fetchSellState(context.mint, owner, context.tokenProgram);
      const bondingCurve = await loadBondingCurveState(this.connection, context.mint);

      if (!bondingCurve) {
        throw new Error(`Bonding curve not found for ${context.mint.toBase58()}`);
      }

      return {
        mode: "bonding",
        chunks: await Promise.all(
          chunks.map(async (tokenAmountIn) => {
            const expectedOutputAmount = bnToBigint(
              getSellSolAmountFromTokenAmount({
                global,
                feeConfig,
                mintSupply: bondingCurve.tokenTotalSupply,
                bondingCurve,
                amount: bigintToBn(tokenAmountIn),
              }),
            );

            return {
              instructions: await this.offlinePumpSdk.sellInstructions({
                global,
                ...sellState,
                mint: context.mint,
                user: owner,
                amount: bigintToBn(tokenAmountIn),
                solAmount: bigintToBn(expectedOutputAmount),
                slippage: slippageBps / 100,
                tokenProgram: context.tokenProgram,
                mayhemMode: bondingCurve.isMayhemMode,
                cashback: bondingCurve.isCashbackCoin,
              }),
              cleanupInstructions: [],
              signers: [],
              inputAmount: tokenAmountIn,
              expectedOutputAmount,
            };
          }),
        ),
      };
    }

    const swapState = await this.onlinePumpAmmSdk.swapSolanaState(context.poolKey!, owner);
    return {
      mode: "amm",
      chunks: await Promise.all(
        chunks.map(async (tokenAmountIn) => ({
          instructions: await this.offlinePumpAmmSdk.sellBaseInput(
            swapState,
            bigintToBn(tokenAmountIn),
            slippageBps / 100,
          ),
          cleanupInstructions: [],
          signers: [],
          inputAmount: tokenAmountIn,
          expectedOutputAmount: bnToBigint(
            sellBaseInput({
              base: bigintToBn(tokenAmountIn),
              slippage: slippageBps / 100,
              baseReserve: swapState.poolBaseAmount,
              quoteReserve: swapState.poolQuoteAmount,
              globalConfig: swapState.globalConfig,
              baseMintAccount: swapState.baseMintAccount,
              baseMint: swapState.baseMint,
              coinCreator: swapState.pool.coinCreator,
              creator: swapState.pool.creator,
              feeConfig: swapState.feeConfig,
            }).uiQuote,
          ),
        })),
      ),
    };
  }
}
