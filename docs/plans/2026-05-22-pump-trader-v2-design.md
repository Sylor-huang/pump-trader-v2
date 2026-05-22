# Pump Trader V2 Design

**Date:** 2026-05-22

**Goal:** Create a new npm package in this directory that accepts a token mint, automatically determines whether trading should use Pump bonding curve or Pump AMM, and returns unsigned trade instructions built through the official Pump SDK packages instead of hand-written instruction layouts.

## Scope

- Build a new TypeScript npm package in `/Users/mac/MyCodes/pump_trader_v2`
- Support automatic trade-mode detection for a token mint
- Support unsigned buy and sell flows
- Return instruction-building results for caller-managed signing and submission
- Use `@pump-fun/pump-sdk` for bonding curve trades
- Use `@pump-fun/pump-swap-sdk` for AMM trades

## Non-Goals

- No private key management
- No transaction signing
- No transaction submission or confirmation polling
- No coin creation or pool creation features
- No attempt to preserve the old single-file `PumpTrader` class shape

## Existing Project Findings

The current `/Users/mac/mycodes/pump_trader` project already contains the core domain logic that should be preserved conceptually:

- `getTradeMode(tokenAddr)` selects `"bonding"` vs `"amm"`
- `autoBuy()` and `autoSell()` dispatch based on the detected mode
- Bonding and AMM flows each calculate expected output, slippage limits, and chunking
- The weak point is that instruction account metas and serialized data are hand-built in `index.ts`

The new package should keep the good parts:

- token program detection
- mode detection
- slippage and chunk planning
- chunked trade planning

But should replace manual instruction construction with the official SDKs.

## External SDK Constraints

Based on the current npm package pages:

- `@pump-fun/pump-sdk` exposes official bonding-curve helpers such as `fetchGlobal`, `fetchBuyState`, `buyInstructions`, `fetchSellState`, and `sellInstructions`
- `@pump-fun/pump-swap-sdk` exposes `PumpAmmSdk` and `PumpAmmInternalSdk`, with the internal SDK explicitly positioned for low-level programmatic instruction customization

Design implication:

- Bonding flows should be built through `PumpSdk`
- AMM flows should prefer `PumpAmmInternalSdk` where custom instruction output is needed for unsigned transaction assembly

Sources:

- [@pump-fun/pump-sdk on npm](https://www.npmjs.com/package/%40pump-fun/pump-sdk)
- [@pump-fun/pump-swap-sdk on npm](https://www.npmjs.com/package/%40pump-fun/pump-swap-sdk)

## Recommended Architecture

Use a layered `planner + builder` design.

### Layer 1: Market detection

Responsible for:

- validating token mint input
- detecting token program (`TOKEN_PROGRAM_ID` vs `TOKEN_2022_PROGRAM_ID`)
- determining whether the mint is trading on Pump bonding curve or Pump AMM

Primary output:

- `TradeContext`

Example shape:

```ts
type TradeMode = "bonding" | "amm";

interface TradeContext {
  mint: PublicKey;
  mode: TradeMode;
  tokenProgram: PublicKey;
  quoteMint: PublicKey;
}
```

### Layer 2: Trade planning

Responsible for:

- normalizing buy/sell request inputs
- computing split chunks
- computing slippage bounds per chunk
- preparing the exact SDK call inputs per chunk

Primary output:

- `TradePlan`

Example shape:

```ts
interface TradeChunkPlan {
  side: "buy" | "sell";
  mode: "bonding" | "amm";
  inputAmount: bigint;
  expectedOutputAmount: bigint;
  minOutputAmount?: bigint;
  maxInputAmount?: bigint;
}

interface TradePlan {
  context: TradeContext;
  chunks: TradeChunkPlan[];
}
```

### Layer 3: Instruction building

Responsible for:

- calling the official SDKs
- adding ATA / WSOL preparation instructions where required
- returning unsigned instruction bundles plus metadata the caller can use to assemble transactions

Primary output:

- `BuiltTradeInstructions`

Example shape:

```ts
interface InstructionBundle {
  instructions: TransactionInstruction[];
  cleanupInstructions: TransactionInstruction[];
  signers: Signer[];
}

interface BuiltTradeInstructions {
  mode: "bonding" | "amm";
  chunks: Array<InstructionBundle & {
    inputAmount: bigint;
    expectedOutputAmount: bigint;
  }>;
}
```

## Public API

Expose a low-level explicit API and a thin convenience API.

### Explicit API

```ts
class PumpTradeInstructionBuilder {
  constructor(connection: Connection, options?: BuilderOptions);

  detectTradeContext(mint: PublicKey | string): Promise<TradeContext>;
  planBuy(input: BuyRequest): Promise<TradePlan>;
  planSell(input: SellRequest): Promise<TradePlan>;
  buildInstructions(plan: TradePlan, owner: PublicKey): Promise<BuiltTradeInstructions>;
}
```

### Convenience API

```ts
createBuyInstructions(input: BuyRequest & { owner: PublicKey }): Promise<BuiltTradeInstructions>;
createSellInstructions(input: SellRequest & { owner: PublicKey }): Promise<BuiltTradeInstructions>;
```

This keeps the package ergonomic while still exposing inspectable intermediate state.

## Proposed Package Structure

```text
src/
  index.ts
  constants.ts
  types.ts
  utils/
    amount.ts
    ata.ts
    token-program.ts
  detection/
    trade-context.ts
    bonding.ts
    amm.ts
  planning/
    slippage.ts
    chunking.ts
    plan-buy.ts
    plan-sell.ts
  builders/
    bonding-builder.ts
    amm-builder.ts
    transaction-prep.ts
  client/
    pump-trade-instruction-builder.ts
tests/
  detection.test.ts
  planning.test.ts
  builders.test.ts
  fixtures/
```

## Trade-Mode Detection Rules

Detection should be deterministic and inspectable.

Recommended order:

1. Detect token program by probing the mint against Token-2022 first, then classic SPL Token
2. Attempt to load Pump bonding state for the mint
3. If bonding state exists and `complete === false`, use `bonding`
4. If bonding state exists and `complete === true`, use `amm`
5. If bonding state cannot be loaded, attempt to resolve the Pump AMM pool
6. If AMM pool exists, use `amm`
7. Otherwise throw a typed `UnsupportedPumpMintError`

This preserves the current project’s behavior while making failures explicit instead of silently defaulting.

## Bonding Trade Design

Use `PumpSdk`.

Buy flow:

- fetch global once and cache it
- fetch buy state for `(mint, owner)`
- compute token amount and slippage limit
- call SDK `buyInstructions(...)`
- prepend ATA creation when needed if the SDK does not already include it

Sell flow:

- fetch global once and cache it
- fetch sell state for `(mint, owner)`
- compute minimum SOL output using slippage
- call SDK `sellInstructions(...)`

Important design choice:

- The package should treat SDK-returned instructions as authoritative and should not manually rebuild Pump program account metas.

## AMM Trade Design

Use `@pump-fun/pump-swap-sdk`, preferring the lower-level internal SDK when necessary.

Buy flow:

- resolve pool / market state for the mint
- compute expected output from reserves or SDK quote helpers
- prepare WSOL input account instructions when quote is SOL
- build swap instructions through the SDK
- append WSOL cleanup instructions when the flow wraps SOL

Sell flow:

- resolve pool / market state
- compute minimum quote output using slippage
- build swap instructions through the SDK
- include quote-account cleanup if temporary WSOL is created

Important design choice:

- We should reuse SDK pool state and instruction assembly rather than porting the current hand-written AMM account layout.

## Amounts, Slippage, and Chunking

The package should preserve the current library’s practical behavior:

- big integer inputs only at the internal API boundary
- configurable `maxQuotePerTx` / `maxBasePerTx` style chunking
- configurable slippage model

Proposed request shape:

```ts
interface SlippageConfig {
  bps: number;
}

interface CommonTradeRequest {
  mint: PublicKey | string;
  slippageBps?: number;
  maxAmountPerTx?: bigint;
}

interface BuyRequest extends CommonTradeRequest {
  quoteAmountIn: bigint;
}

interface SellRequest extends CommonTradeRequest {
  tokenAmountIn: bigint;
}
```

To keep the first version small:

- use a fixed slippage-bps input first
- do not port the old dynamic impact-based slippage model in v1
- keep chunking simple and deterministic

## Error Handling

Use typed errors:

- `UnsupportedPumpMintError`
- `TradeContextDetectionError`
- `BondingStateFetchError`
- `AmmPoolNotFoundError`
- `InstructionBuildError`
- `InvalidTradeInputError`

All public methods should reject with typed errors carrying enough context to debug the failed mint and side.

## Testing Strategy

Tests should focus on deterministic behavior without needing live chain access.

Unit tests:

- token program detection fallback logic with mocked RPC responses
- trade-mode detection precedence
- chunk planning
- slippage bound calculations
- convenience API wiring

Integration-style mocked tests:

- bonding buy uses `PumpSdk.buyInstructions`
- bonding sell uses `PumpSdk.sellInstructions`
- AMM buy uses swap SDK builder path
- AMM sell uses swap SDK builder path
- returned instructions stay unsigned and preserve caller ownership

Regression tests:

- preserve the old project’s mode-detection behavior for representative fixtures

## Implementation Risks

- The official swap SDK API may not map 1:1 to the current hand-written AMM flow, especially around WSOL setup and returned helper state
- Current npm docs show API categories but not every exact type signature, so implementation must inspect installed package types before coding
- The quote-mint and non-SOL pool path should be kept out of scope for v1 unless the SDK makes it trivial

## V1 Recommendation

Ship a narrow but solid first version:

- SOL-quoted Pump trades only
- automatic `bonding` vs `amm` selection
- unsigned instruction output only
- buy and sell only
- minimal slippage model
- no transaction sending

This is enough to replace the current custom instruction code without overfitting to edge cases on day one.
