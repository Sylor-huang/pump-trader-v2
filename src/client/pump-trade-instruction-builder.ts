import type {
  BondingCurve,
  OnlinePumpSdk as OnlinePumpSdkType,
  PumpSdk as PumpSdkType,
} from "@pump-fun/pump-sdk";
import type {
  OnlinePumpAmmSdk as OnlinePumpAmmSdkType,
  PumpAmmSdk as PumpAmmSdkType,
  SwapSolanaState,
} from "@pump-fun/pump-swap-sdk";
import type { Connection } from "@solana/web3.js";

import { DEFAULT_SLIPPAGE_BPS } from "../constants.js";
import { loadBondingCurveState } from "../detection/bonding.js";
import { detectTradeContext } from "../detection/trade-context.js";
import { buildAmmInstructions } from "../builders/amm-builder.js";
import { buildBondingInstructions } from "../builders/bonding-builder.js";
import { createBuyPlan } from "../planning/plan-buy.js";
import { createSellPlan } from "../planning/plan-sell.js";
import {
  OnlinePumpSdk,
  PumpSdk,
  getBuyTokenAmountFromSolAmount,
  getSellSolAmountFromTokenAmount,
} from "../sdk/pump-sdk.js";
import {
  OnlinePumpAmmSdk,
  PumpAmmSdk,
  buyQuoteInput,
  sellBaseInput,
} from "../sdk/pump-swap-sdk.js";
import type {
  BuiltTradeInstructions,
  BuyInstructionsRequest,
  BuyRequest,
  PumpTradeInstructionBuilderOptions,
  SellInstructionsRequest,
  SellRequest,
  TradeContext,
  TradePlan,
} from "../types.js";
import { bnToBigint, bigintToBn, toPublicKey } from "../utils/amount.js";

export class PumpTradeInstructionBuilder {
  private readonly connection: Connection;
  private readonly onlinePumpSdk: OnlinePumpSdkType;
  private readonly offlinePumpSdk: PumpSdkType;
  private readonly onlinePumpAmmSdk: OnlinePumpAmmSdkType;
  private readonly offlinePumpAmmSdk: PumpAmmSdkType;
  private readonly options: PumpTradeInstructionBuilderOptions;

  constructor(connection: Connection, options: PumpTradeInstructionBuilderOptions = {}) {
    this.connection = connection;
    this.onlinePumpSdk = new OnlinePumpSdk(connection);
    this.offlinePumpSdk = new PumpSdk();
    this.onlinePumpAmmSdk = new OnlinePumpAmmSdk(connection);
    this.offlinePumpAmmSdk = new PumpAmmSdk();
    this.options = options;
  }

  async detectTradeContext(mint: string | import("@solana/web3.js").PublicKey) {
    return detectTradeContext({
      connection: this.connection,
      mint,
    });
  }

  async planBuy(request: BuyRequest): Promise<TradePlan> {
    const context = await this.detectTradeContext(request.mint);
    const slippageBps = request.slippageBps ?? this.options.defaultSlippageBps ?? DEFAULT_SLIPPAGE_BPS;
    const normalizedRequest: BuyRequest = {
      ...request,
      slippageBps,
      maxAmountPerTx: request.maxAmountPerTx ?? this.options.defaultMaxAmountPerTx,
    };

    if (context.mode === "bonding") {
      const global = await this.onlinePumpSdk.fetchGlobal();
      const feeConfig = await this.onlinePumpSdk.fetchFeeConfig();
      const bondingCurve = await this.fetchBondingCurveForPlanning(context);

      return createBuyPlan(normalizedRequest, {
        context,
        quoteBuyOut: async (amountIn) => ({
          expectedOutputAmount: bnToBigint(
            getBuyTokenAmountFromSolAmount({
              global,
              feeConfig,
              mintSupply: bondingCurve.tokenTotalSupply,
              bondingCurve,
              amount: bigintToBn(amountIn),
              quoteMint: context.quoteMint,
            }),
          ),
        }),
      });
    }

    const swapState = await this.fetchSwapStateForPlanning(context);

    return createBuyPlan(normalizedRequest, {
      context,
      quoteBuyOut: async (amountIn) => ({
        expectedOutputAmount: bnToBigint(
          buyQuoteInput({
            quote: bigintToBn(amountIn),
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
      }),
    });
  }

  async planSell(request: SellRequest): Promise<TradePlan> {
    const context = await this.detectTradeContext(request.mint);
    const slippageBps = request.slippageBps ?? this.options.defaultSlippageBps ?? DEFAULT_SLIPPAGE_BPS;
    const normalizedRequest: SellRequest = {
      ...request,
      slippageBps,
      maxAmountPerTx: request.maxAmountPerTx ?? this.options.defaultMaxAmountPerTx,
    };

    if (context.mode === "bonding") {
      const global = await this.onlinePumpSdk.fetchGlobal();
      const feeConfig = await this.onlinePumpSdk.fetchFeeConfig();
      const bondingCurve = await this.fetchBondingCurveForPlanning(context);

      return createSellPlan(normalizedRequest, {
        context,
        quoteSellOut: async (amountIn) => ({
          expectedOutputAmount: bnToBigint(
            getSellSolAmountFromTokenAmount({
              global,
              feeConfig,
              mintSupply: bondingCurve.tokenTotalSupply,
              bondingCurve,
              amount: bigintToBn(amountIn),
            }),
          ),
        }),
      });
    }

    const swapState = await this.fetchSwapStateForPlanning(context);

    return createSellPlan(normalizedRequest, {
      context,
      quoteSellOut: async (amountIn) => ({
        expectedOutputAmount: bnToBigint(
          sellBaseInput({
            base: bigintToBn(amountIn),
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
      }),
    });
  }

  async buildInstructions(
    plan: TradePlan,
    owner: string | import("@solana/web3.js").PublicKey,
  ): Promise<BuiltTradeInstructions> {
    const ownerKey = toPublicKey(owner);

    if (plan.context.mode === "bonding") {
      return buildBondingInstructions({
        side: plan.chunks[0]?.side ?? "buy",
        owner: ownerKey,
        plan,
        onlineSdk: this.onlinePumpSdk,
        sdk: this.offlinePumpSdk,
      });
    }

    return buildAmmInstructions({
      side: plan.chunks[0]?.side ?? "buy",
      owner: ownerKey,
      plan,
      onlineSdk: this.onlinePumpAmmSdk,
      sdk: this.offlinePumpAmmSdk,
    });
  }

  async createBuyInstructions(request: BuyInstructionsRequest): Promise<BuiltTradeInstructions> {
    const { owner, ...planRequest } = request;
    const plan = await this.planBuy(planRequest);
    return this.buildInstructions(plan, owner);
  }

  async createSellInstructions(request: SellInstructionsRequest): Promise<BuiltTradeInstructions> {
    const { owner, ...planRequest } = request;
    const plan = await this.planSell(planRequest);
    return this.buildInstructions(plan, owner);
  }

  private async fetchBondingCurveForPlanning(context: TradeContext): Promise<BondingCurve> {
    const bondingCurve = await loadBondingCurveState(this.connection, context.mint);

    if (!bondingCurve) {
      throw new Error(`Bonding curve not found for ${context.mint.toBase58()}`);
    }

    return bondingCurve;
  }

  private async fetchSwapStateForPlanning(context: TradeContext): Promise<SwapSolanaState> {
    return this.onlinePumpAmmSdk.swapSolanaState(context.poolKey!, context.mint);
  }
}
