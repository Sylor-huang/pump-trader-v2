# Pump Trader V2 Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Build a new TypeScript npm package that detects whether a Pump token should trade on bonding curve or AMM and returns unsigned instructions using the official Pump SDKs.

**Architecture:** The package is organized as a small client over three layers: detection, planning, and SDK-backed instruction building. Detection identifies token program and trade mode, planning computes chunking and slippage bounds, and builders call the official Pump SDKs to produce unsigned instruction bundles for the caller to sign and submit.

**Tech Stack:** TypeScript, Node.js, `@solana/web3.js`, `@solana/spl-token`, `@pump-fun/pump-sdk`, `@pump-fun/pump-swap-sdk`, `tsx`, Node test runner

---

### Task 1: Scaffold the npm package

**Files:**
- Create: `package.json`
- Create: `tsconfig.json`
- Create: `src/index.ts`
- Create: `src/types.ts`
- Create: `.gitignore`
- Create: `README.md`

**Step 1: Write the failing test**

Create `tests/package-entry.test.ts`:

```ts
import test from "node:test";
import assert from "node:assert/strict";

import * as mod from "../src/index";

test("package exports the main builder API", () => {
  assert.equal(typeof mod.PumpTradeInstructionBuilder, "function");
});
```

**Step 2: Run test to verify it fails**

Run: `node --test --import tsx tests/package-entry.test.ts`
Expected: FAIL because `src/index.ts` does not exist or does not export the builder

**Step 3: Write minimal implementation**

- Create package metadata and scripts:
  - `build`: `tsc`
  - `test`: `node --test --import tsx tests/**/*.test.ts`
- Create a minimal `PumpTradeInstructionBuilder` export from `src/index.ts`
- Add base shared types file

**Step 4: Run test to verify it passes**

Run: `node --test --import tsx tests/package-entry.test.ts`
Expected: PASS

**Step 5: Commit**

```bash
git add package.json tsconfig.json src/index.ts src/types.ts README.md .gitignore tests/package-entry.test.ts
git commit -m "chore: scaffold pump trader v2 package"
```

### Task 2: Add core types and constants

**Files:**
- Create: `src/constants.ts`
- Modify: `src/types.ts`
- Test: `tests/types.test.ts`

**Step 1: Write the failing test**

Create `tests/types.test.ts`:

```ts
import test from "node:test";
import assert from "node:assert/strict";

import { PROGRAM_IDS, SOL_MINT } from "../src/index";

test("exports core constants", () => {
  assert.ok(PROGRAM_IDS.PUMP);
  assert.ok(PROGRAM_IDS.PUMP_AMM);
  assert.ok(SOL_MINT);
});
```

**Step 2: Run test to verify it fails**

Run: `node --test --import tsx tests/types.test.ts`
Expected: FAIL because constants are not exported yet

**Step 3: Write minimal implementation**

- Add immutable public constants:
  - Pump program IDs
  - SOL mint
  - default compute-unit settings
- Define public types:
  - `TradeMode`
  - `TradeContext`
  - `TradePlan`
  - `BuiltTradeInstructions`
  - `BuyRequest`
  - `SellRequest`

**Step 4: Run test to verify it passes**

Run: `node --test --import tsx tests/types.test.ts`
Expected: PASS

**Step 5: Commit**

```bash
git add src/constants.ts src/types.ts src/index.ts tests/types.test.ts
git commit -m "feat: add public constants and core types"
```

### Task 3: Implement amount, slippage, and chunking utilities

**Files:**
- Create: `src/utils/amount.ts`
- Create: `src/planning/slippage.ts`
- Create: `src/planning/chunking.ts`
- Test: `tests/planning.test.ts`

**Step 1: Write the failing test**

Create `tests/planning.test.ts`:

```ts
import test from "node:test";
import assert from "node:assert/strict";

import { splitAmountByMax, applySlippageBps } from "../src/index";

test("splitAmountByMax chunks deterministic bigint amounts", () => {
  assert.deepEqual(splitAmountByMax(10n, 4n), [4n, 4n, 2n]);
});

test("applySlippageBps inflates buy-side max input", () => {
  assert.equal(applySlippageBps(1000n, 500, "increase"), 1050n);
});
```

**Step 2: Run test to verify it fails**

Run: `node --test --import tsx tests/planning.test.ts`
Expected: FAIL because utilities are not implemented

**Step 3: Write minimal implementation**

- Implement deterministic bigint chunking
- Implement basis-point slippage helpers
- Export the utilities for reuse and tests

**Step 4: Run test to verify it passes**

Run: `node --test --import tsx tests/planning.test.ts`
Expected: PASS

**Step 5: Commit**

```bash
git add src/utils/amount.ts src/planning/slippage.ts src/planning/chunking.ts src/index.ts tests/planning.test.ts
git commit -m "feat: add planning utility helpers"
```

### Task 4: Implement token-program detection

**Files:**
- Create: `src/utils/token-program.ts`
- Modify: `src/types.ts`
- Test: `tests/token-program.test.ts`

**Step 1: Write the failing test**

Create `tests/token-program.test.ts`:

```ts
import test from "node:test";
import assert from "node:assert/strict";
import { PublicKey } from "@solana/web3.js";

import { detectTokenProgramForMint } from "../src/index";

test("detectTokenProgramForMint prefers token-2022 when probe succeeds", async () => {
  const mint = new PublicKey("So11111111111111111111111111111111111111112");
  const connection = {
    getAccountInfo: async () => ({ owner: new PublicKey("TokenzQdBNbLqP5VEhdkAS6EPFLC1PHnBqCXEpPxuEb") })
  } as any;

  const result = await detectTokenProgramForMint(connection, mint);
  assert.equal(result.programId.toBase58(), "TokenzQdBNbLqP5VEhdkAS6EPFLC1PHnBqCXEpPxuEb");
});
```

**Step 2: Run test to verify it fails**

Run: `node --test --import tsx tests/token-program.test.ts`
Expected: FAIL because detection helper does not exist

**Step 3: Write minimal implementation**

- Implement token-program detection based on mint account owner
- Return a typed result carrying both symbolic type and `programId`
- Keep logic free of wallet assumptions

**Step 4: Run test to verify it passes**

Run: `node --test --import tsx tests/token-program.test.ts`
Expected: PASS

**Step 5: Commit**

```bash
git add src/utils/token-program.ts src/types.ts src/index.ts tests/token-program.test.ts
git commit -m "feat: add token program detection"
```

### Task 5: Implement trade-context detection

**Files:**
- Create: `src/detection/bonding.ts`
- Create: `src/detection/amm.ts`
- Create: `src/detection/trade-context.ts`
- Create: `src/errors.ts`
- Test: `tests/detection.test.ts`

**Step 1: Write the failing test**

Create `tests/detection.test.ts`:

```ts
import test from "node:test";
import assert from "node:assert/strict";
import { PublicKey } from "@solana/web3.js";

import { detectTradeContext } from "../src/index";

test("detectTradeContext returns bonding when bonding state exists and is incomplete", async () => {
  const mint = new PublicKey("So11111111111111111111111111111111111111112");
  const result = await detectTradeContext({
    connection: {} as any,
    mint,
    detectTokenProgram: async () => ({
      type: "TOKEN_PROGRAM_ID",
      programId: new PublicKey("TokenkegQfeZyiNwAJbNbGKPFXCWuBvf9Ss623VQ5DA")
    }),
    loadBondingState: async () => ({ complete: false, quoteMint: null }),
    loadAmmPool: async () => {
      throw new Error("should not be called");
    }
  });

  assert.equal(result.mode, "bonding");
});
```

**Step 2: Run test to verify it fails**

Run: `node --test --import tsx tests/detection.test.ts`
Expected: FAIL because trade-context detection does not exist

**Step 3: Write minimal implementation**

- Add typed errors for unsupported mints and detection failures
- Implement detection precedence:
  - bonding incomplete => `bonding`
  - bonding complete => `amm`
  - missing bonding + existing pool => `amm`
  - otherwise typed error

**Step 4: Run test to verify it passes**

Run: `node --test --import tsx tests/detection.test.ts`
Expected: PASS

**Step 5: Commit**

```bash
git add src/detection src/errors.ts src/index.ts tests/detection.test.ts
git commit -m "feat: add trade context detection"
```

### Task 6: Install official Pump SDK dependencies and inspect their runtime types

**Files:**
- Modify: `package.json`
- Modify: `package-lock.json`
- Create: `src/sdk/types.ts`

**Step 1: Write the failing test**

Add to `tests/package-entry.test.ts`:

```ts
test("sdk wrappers are importable", async () => {
  const mod = await import("../src/sdk/types");
  assert.ok(mod);
});
```

**Step 2: Run test to verify it fails**

Run: `node --test --import tsx tests/package-entry.test.ts`
Expected: FAIL because SDK wrapper module is missing and dependencies are not installed

**Step 3: Write minimal implementation**

- Add dependencies:
  - `@pump-fun/pump-sdk`
  - `@pump-fun/pump-swap-sdk`
- Install packages
- Create a thin internal module to centralize imported SDK types and constructors

**Step 4: Run test to verify it passes**

Run: `node --test --import tsx tests/package-entry.test.ts`
Expected: PASS

**Step 5: Commit**

```bash
git add package.json package-lock.json src/sdk/types.ts tests/package-entry.test.ts
git commit -m "chore: add official pump sdk dependencies"
```

### Task 7: Implement bonding trade planner

**Files:**
- Create: `src/planning/plan-buy.ts`
- Create: `src/planning/plan-sell.ts`
- Modify: `src/types.ts`
- Test: `tests/bonding-plan.test.ts`

**Step 1: Write the failing test**

Create `tests/bonding-plan.test.ts`:

```ts
import test from "node:test";
import assert from "node:assert/strict";
import { PublicKey } from "@solana/web3.js";

import { createBondingBuyPlan } from "../src/index";

test("createBondingBuyPlan creates chunk metadata with max input bounds", async () => {
  const mint = new PublicKey("So11111111111111111111111111111111111111112");
  const plan = await createBondingBuyPlan({
    mint,
    quoteAmountIn: 10n,
    slippageBps: 500,
    maxAmountPerTx: 4n
  }, {
    context: {
      mint,
      mode: "bonding",
      tokenProgram: new PublicKey("TokenkegQfeZyiNwAJbNbGKPFXCWuBvf9Ss623VQ5DA"),
      quoteMint: new PublicKey("So11111111111111111111111111111111111111112")
    },
    quoteBuyOut: async (amount: bigint) => ({ expectedOutputAmount: amount * 2n })
  } as any);

  assert.equal(plan.chunks.length, 3);
  assert.equal(plan.chunks[0].maxInputAmount, 4n + 0n + 1n);
});
```

**Step 2: Run test to verify it fails**

Run: `node --test --import tsx tests/bonding-plan.test.ts`
Expected: FAIL because bonding planners are not implemented

**Step 3: Write minimal implementation**

- Create generic buy and sell planners over chunking and slippage helpers
- Keep planners mode-agnostic where possible
- Return stable chunk metadata for later builder steps

**Step 4: Run test to verify it passes**

Run: `node --test --import tsx tests/bonding-plan.test.ts`
Expected: PASS

**Step 5: Commit**

```bash
git add src/planning src/types.ts src/index.ts tests/bonding-plan.test.ts
git commit -m "feat: add trade planning layer"
```

### Task 8: Implement bonding instruction builder with `@pump-fun/pump-sdk`

**Files:**
- Create: `src/builders/transaction-prep.ts`
- Create: `src/builders/bonding-builder.ts`
- Test: `tests/bonding-builder.test.ts`

**Step 1: Write the failing test**

Create `tests/bonding-builder.test.ts`:

```ts
import test from "node:test";
import assert from "node:assert/strict";
import { PublicKey, TransactionInstruction } from "@solana/web3.js";

import { buildBondingInstructions } from "../src/index";

test("buildBondingInstructions delegates to PumpSdk buyInstructions", async () => {
  const owner = new PublicKey("11111111111111111111111111111111");
  const fakeIx = new TransactionInstruction({ keys: [], programId: owner });

  const result = await buildBondingInstructions({
    side: "buy",
    owner,
    plan: {
      context: {
        mint: owner,
        mode: "bonding",
        tokenProgram: owner,
        quoteMint: owner
      },
      chunks: [{ side: "buy", mode: "bonding", inputAmount: 1n, expectedOutputAmount: 2n, maxInputAmount: 2n }]
    },
    sdk: {
      buyInstructions: async () => ({ instructions: [fakeIx], signers: [] })
    } as any
  });

  assert.equal(result.chunks[0].instructions[0], fakeIx);
});
```

**Step 2: Run test to verify it fails**

Run: `node --test --import tsx tests/bonding-builder.test.ts`
Expected: FAIL because the bonding builder is not implemented

**Step 3: Write minimal implementation**

- Build bonding instruction bundles by delegating to official SDK methods
- Normalize SDK outputs into package `InstructionBundle` results
- Add account-prep helpers only if the SDK does not already return them

**Step 4: Run test to verify it passes**

Run: `node --test --import tsx tests/bonding-builder.test.ts`
Expected: PASS

**Step 5: Commit**

```bash
git add src/builders/transaction-prep.ts src/builders/bonding-builder.ts src/index.ts tests/bonding-builder.test.ts
git commit -m "feat: add bonding instruction builder"
```

### Task 9: Implement AMM instruction builder with `@pump-fun/pump-swap-sdk`

**Files:**
- Create: `src/builders/amm-builder.ts`
- Test: `tests/amm-builder.test.ts`

**Step 1: Write the failing test**

Create `tests/amm-builder.test.ts`:

```ts
import test from "node:test";
import assert from "node:assert/strict";
import { PublicKey, TransactionInstruction } from "@solana/web3.js";

import { buildAmmInstructions } from "../src/index";

test("buildAmmInstructions delegates to swap sdk and preserves cleanup instructions", async () => {
  const owner = new PublicKey("11111111111111111111111111111111");
  const swapIx = new TransactionInstruction({ keys: [], programId: owner });
  const cleanupIx = new TransactionInstruction({ keys: [], programId: owner });

  const result = await buildAmmInstructions({
    side: "buy",
    owner,
    plan: {
      context: {
        mint: owner,
        mode: "amm",
        tokenProgram: owner,
        quoteMint: owner
      },
      chunks: [{ side: "buy", mode: "amm", inputAmount: 1n, expectedOutputAmount: 2n, maxInputAmount: 2n }]
    },
    sdk: {
      swapInstructions: async () => ({ instructions: [swapIx], cleanupInstructions: [cleanupIx], signers: [] })
    } as any
  });

  assert.equal(result.chunks[0].instructions[0], swapIx);
  assert.equal(result.chunks[0].cleanupInstructions[0], cleanupIx);
});
```

**Step 2: Run test to verify it fails**

Run: `node --test --import tsx tests/amm-builder.test.ts`
Expected: FAIL because the AMM builder is not implemented

**Step 3: Write minimal implementation**

- Wrap the official swap SDK instruction builder path
- Normalize WSOL preparation and cleanup instruction handling
- Return unsigned chunk bundles

**Step 4: Run test to verify it passes**

Run: `node --test --import tsx tests/amm-builder.test.ts`
Expected: PASS

**Step 5: Commit**

```bash
git add src/builders/amm-builder.ts src/index.ts tests/amm-builder.test.ts
git commit -m "feat: add amm instruction builder"
```

### Task 10: Implement the main client API

**Files:**
- Create: `src/client/pump-trade-instruction-builder.ts`
- Modify: `src/index.ts`
- Test: `tests/client.test.ts`

**Step 1: Write the failing test**

Create `tests/client.test.ts`:

```ts
import test from "node:test";
import assert from "node:assert/strict";
import { PublicKey } from "@solana/web3.js";

import { PumpTradeInstructionBuilder } from "../src/index";

test("createBuyInstructions detects context, plans trade, and builds instructions", async () => {
  const builder = new PumpTradeInstructionBuilder({} as any) as any;
  builder.detectTradeContext = async () => ({
    mint: new PublicKey("11111111111111111111111111111111"),
    mode: "bonding",
    tokenProgram: new PublicKey("11111111111111111111111111111111"),
    quoteMint: new PublicKey("So11111111111111111111111111111111111111112")
  });
  builder.planBuy = async () => ({
    context: await builder.detectTradeContext(),
    chunks: [{ side: "buy", mode: "bonding", inputAmount: 1n, expectedOutputAmount: 2n, maxInputAmount: 2n }]
  });
  builder.buildInstructions = async (plan: any) => ({ mode: plan.context.mode, chunks: [] });

  const result = await builder.createBuyInstructions({
    mint: "11111111111111111111111111111111",
    owner: new PublicKey("11111111111111111111111111111111"),
    quoteAmountIn: 1n
  });

  assert.equal(result.mode, "bonding");
});
```

**Step 2: Run test to verify it fails**

Run: `node --test --import tsx tests/client.test.ts`
Expected: FAIL because the client orchestration API is incomplete

**Step 3: Write minimal implementation**

- Implement the main class
- Wire explicit methods:
  - `detectTradeContext`
  - `planBuy`
  - `planSell`
  - `buildInstructions`
- Add convenience methods:
  - `createBuyInstructions`
  - `createSellInstructions`

**Step 4: Run test to verify it passes**

Run: `node --test --import tsx tests/client.test.ts`
Expected: PASS

**Step 5: Commit**

```bash
git add src/client/pump-trade-instruction-builder.ts src/index.ts tests/client.test.ts
git commit -m "feat: add main client api"
```

### Task 11: Add README usage and end-to-end verification

**Files:**
- Modify: `README.md`
- Test: `tests/readme-shape.test.ts`

**Step 1: Write the failing test**

Create `tests/readme-shape.test.ts`:

```ts
import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";

test("README documents createBuyInstructions and createSellInstructions", () => {
  const readme = fs.readFileSync(new URL("../README.md", import.meta.url), "utf8");
  assert.match(readme, /createBuyInstructions/);
  assert.match(readme, /createSellInstructions/);
});
```

**Step 2: Run test to verify it fails**

Run: `node --test --import tsx tests/readme-shape.test.ts`
Expected: FAIL because README does not document the final API yet

**Step 3: Write minimal implementation**

- Document installation
- Document the unsigned-instruction contract
- Document example buy and sell usage
- Document the current v1 limits

**Step 4: Run test to verify it passes**

Run: `node --test --import tsx tests/readme-shape.test.ts`
Expected: PASS

**Step 5: Run full verification**

Run: `npm test`
Expected: all tests PASS

Run: `npm run build`
Expected: TypeScript build PASS with emitted output

**Step 6: Commit**

```bash
git add README.md tests/readme-shape.test.ts
git commit -m "docs: add usage examples and verify package"
```
