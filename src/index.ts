import { TOKEN_2022_PROGRAM_ID, TOKEN_PROGRAM_ID } from "@solana/spl-token";
import type { Connection as ConnectionType, PublicKey, Signer, TransactionInstruction } from "@solana/web3.js";
import { Connection, PublicKey as Web3PublicKey } from "@solana/web3.js";
import BN from "bn.js";

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

interface AmmPoolLookupResult {
  poolKey: PublicKey;
  pool: import("@pump-fun/pump-swap-sdk").Pool | null;
  quoteMint: PublicKey;
}

type PumpSdkRuntime = typeof import("@pump-fun/pump-sdk");
type PumpSwapSdkRuntime = typeof import("@pump-fun/pump-swap-sdk");

let pumpSdkRuntimePromise: Promise<PumpSdkRuntime> | undefined;
let pumpSwapSdkRuntimePromise: Promise<PumpSwapSdkRuntime> | undefined;

async function importFirstWorkingModule<T>(
  label: string,
  candidates: string[],
  normalize: (mod: unknown) => T,
  isValid: (mod: T) => boolean,
): Promise<T> {
  const failures: string[] = [];

  for (const candidate of candidates) {
    try {
      const mod = await import(candidate);
      const normalized = normalize(mod);

      if (isValid(normalized)) {
        return normalized;
      }

      failures.push(`${candidate}: module loaded but missing expected exports`);
    } catch (error) {
      failures.push(`${candidate}: ${(error as Error).message}`);
    }
  }

  throw new Error(`Unable to load ${label}\n${failures.join("\n")}`);
}

function candidateUrls(path: string): string[] {
  return [
    path,
    new URL(`../node_modules/${path}`, import.meta.url).href,
    new URL(`../../${path}`, import.meta.url).href,
  ];
}

async function loadPumpSdkRuntime(): Promise<PumpSdkRuntime> {
  if (!pumpSdkRuntimePromise) {
    pumpSdkRuntimePromise = importFirstWorkingModule<PumpSdkRuntime>(
      "@pump-fun/pump-sdk",
      candidateUrls("@pump-fun/pump-sdk"),
      (mod) => {
        const candidate = mod as { default?: unknown };
        if (candidate.default && typeof candidate.default === "object") {
          return candidate.default as PumpSdkRuntime;
        }
        return mod as PumpSdkRuntime;
      },
      (mod) => typeof mod.OnlinePumpSdk === "function" && typeof mod.PumpSdk === "function",
    );
  }

  return pumpSdkRuntimePromise;
}

async function loadPumpSwapSdkRuntime(): Promise<PumpSwapSdkRuntime> {
  if (!pumpSwapSdkRuntimePromise) {
    pumpSwapSdkRuntimePromise = importFirstWorkingModule<PumpSwapSdkRuntime>(
      "@pump-fun/pump-swap-sdk",
      candidateUrls("@pump-fun/pump-swap-sdk"),
      (mod) => mod as PumpSwapSdkRuntime,
      (mod) => typeof mod.OnlinePumpAmmSdk === "function" && typeof mod.PumpAmmSdk === "function",
    );
  }

  return pumpSwapSdkRuntimePromise;
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

function getEffectiveQuoteMint(quoteMint?: PublicKey): PublicKey {
  if (!quoteMint || quoteMint.equals(Web3PublicKey.default)) {
    return SOL_MINT;
  }

  return quoteMint;
}

async function resolveQuoteMint(
  connection: Pick<ConnectionType, "getAccountInfo">,
  quoteMint?: PublicKey,
): Promise<PublicKey> {
  const effectiveQuoteMint = getEffectiveQuoteMint(quoteMint);

  if (effectiveQuoteMint.equals(SOL_MINT)) {
    return SOL_MINT;
  }

  const quoteMintInfo = await connection.getAccountInfo(effectiveQuoteMint);
  return quoteMintInfo ? effectiveQuoteMint : SOL_MINT;
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
  const { bondingCurvePda, PUMP_SDK } = await loadPumpSdkRuntime();
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
): Promise<AmmPoolLookupResult> {
  const { canonicalPumpPoolPda, PUMP_AMM_SDK } = await loadPumpSwapSdkRuntime();
  const poolKey = canonicalPumpPoolPda(mint, quoteMint);
  const accountInfo = await connection.getAccountInfo(poolKey);
  if (!accountInfo) {
    return {
      poolKey,
      pool: null as import("@pump-fun/pump-swap-sdk").Pool | null,
      quoteMint,
    };
  }

  return {
    poolKey,
    pool: PUMP_AMM_SDK.decodePoolNullable(accountInfo),
    quoteMint,
  };
}

async function loadAmmPoolWithFallback(
  connection: Pick<ConnectionType, "getAccountInfo">,
  mint: PublicKey,
  quoteMint?: PublicKey,
): Promise<AmmPoolLookupResult | null> {
  const resolvedQuoteMint = await resolveQuoteMint(connection, quoteMint);
  const attempts: PublicKey[] = [resolvedQuoteMint];

  if (!resolvedQuoteMint.equals(SOL_MINT)) {
    attempts.push(SOL_MINT);
  }

  for (const candidateQuoteMint of attempts) {
    const result = await loadAmmPool(connection, mint, candidateQuoteMint);
    if (result.pool) {
      return result;
    }
  }

  return null;
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
      quoteMint: await resolveQuoteMint(args.connection, bondingCurve.quoteMint),
    };
  }

  const poolLookup = await loadAmmPoolWithFallback(args.connection, mint, bondingCurve?.quoteMint);

  if (poolLookup) {
    return {
      mint,
      mode: "amm",
      tokenProgram: tokenProgram.programId,
      quoteMint: poolLookup.quoteMint,
      poolKey: poolLookup.poolKey,
    };
  }

  if (bondingCurve?.complete) {
    throw new Error(`Bonding curve is complete but AMM pool was not found for ${mint.toBase58()}`);
  }

  throw new Error(`Unable to determine Pump market for ${mint.toBase58()}`);
}

export class PumpTradeInstructionBuilder {
  private readonly connection: ConnectionType;
  private readonly options: PumpTradeInstructionBuilderOptions;
  private pumpSdkClientsPromise:
    | Promise<{ online: import("@pump-fun/pump-sdk").OnlinePumpSdk; offline: import("@pump-fun/pump-sdk").PumpSdk }>
    | undefined;
  private pumpAmmSdkClientsPromise:
    | Promise<{
        online: import("@pump-fun/pump-swap-sdk").OnlinePumpAmmSdk;
        offline: import("@pump-fun/pump-swap-sdk").PumpAmmSdk;
      }>
    | undefined;

  constructor(connection: ConnectionType | string, options: PumpTradeInstructionBuilderOptions = {}) {
    this.connection =
      typeof connection === "string"
        ? new Connection(connection, options.commitment ?? "confirmed")
        : connection;
    this.options = options;
  }

  private async getPumpSdkClients() {
    if (!this.pumpSdkClientsPromise) {
      this.pumpSdkClientsPromise = loadPumpSdkRuntime().then(({ OnlinePumpSdk, PumpSdk }) => ({
        online: new OnlinePumpSdk(this.connection),
        offline: new PumpSdk(),
      }));
    }

    return this.pumpSdkClientsPromise;
  }

  private async getPumpAmmSdkClients() {
    if (!this.pumpAmmSdkClientsPromise) {
      this.pumpAmmSdkClientsPromise = loadPumpSwapSdkRuntime().then(({ OnlinePumpAmmSdk, PumpAmmSdk }) => ({
        online: new OnlinePumpAmmSdk(this.connection),
        offline: new PumpAmmSdk(),
      }));
    }

    return this.pumpAmmSdkClientsPromise;
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

    const poolLookup = await loadAmmPoolWithFallback(this.connection, context.mint, context.quoteMint);
    if (!poolLookup?.pool) {
      throw new Error(`AMM pool not found for ${context.mint.toBase58()}`);
    }
    const { pool, quoteMint, poolKey } = poolLookup;

    const [baseBalance, quoteBalance] = await Promise.all([
      this.connection.getTokenAccountBalance(pool.poolBaseTokenAccount),
      this.connection.getTokenAccountBalance(pool.poolQuoteTokenAccount),
    ]);

    return {
      mint: context.mint,
      mode: "amm",
      tokenProgram: context.tokenProgram,
      quoteMint,
      poolKey,
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
    const { getBuyTokenAmountFromSolAmount } = await loadPumpSdkRuntime();
    const { buyQuoteInput } = await loadPumpSwapSdkRuntime();

    if (context.mode === "bonding") {
      const { online: onlinePumpSdk, offline: offlinePumpSdk } = await this.getPumpSdkClients();
      const global = await onlinePumpSdk.fetchGlobal();
      const feeConfig = await onlinePumpSdk.fetchFeeConfig();
      const buyState = await onlinePumpSdk.fetchBuyState(context.mint, owner, context.tokenProgram);
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
              instructions: await offlinePumpSdk.buyInstructions({
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

    const { online: onlinePumpAmmSdk, offline: offlinePumpAmmSdk } = await this.getPumpAmmSdkClients();
    const swapState = await onlinePumpAmmSdk.swapSolanaState(context.poolKey!, owner);
    return {
      mode: "amm",
      chunks: await Promise.all(
        chunks.map(async (quoteAmountIn) => ({
          instructions: await offlinePumpAmmSdk.buyQuoteInput(
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
    const { getSellSolAmountFromTokenAmount } = await loadPumpSdkRuntime();
    const { sellBaseInput } = await loadPumpSwapSdkRuntime();

    if (context.mode === "bonding") {
      const { online: onlinePumpSdk, offline: offlinePumpSdk } = await this.getPumpSdkClients();
      const global = await onlinePumpSdk.fetchGlobal();
      const feeConfig = await onlinePumpSdk.fetchFeeConfig();
      const sellState = await onlinePumpSdk.fetchSellState(context.mint, owner, context.tokenProgram);
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
              instructions: await offlinePumpSdk.sellInstructions({
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

    const { online: onlinePumpAmmSdk, offline: offlinePumpAmmSdk } = await this.getPumpAmmSdkClients();
    const swapState = await onlinePumpAmmSdk.swapSolanaState(context.poolKey!, owner);
    return {
      mode: "amm",
      chunks: await Promise.all(
        chunks.map(async (tokenAmountIn) => ({
          instructions: await offlinePumpAmmSdk.sellBaseInput(
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
