# pump-trader-v2

Build unsigned Pump buy/sell instructions with the official Pump SDKs.

## Install

```bash
npm install
```

## What it does

- Accepts a token mint
- Detects whether the token should trade on Pump bonding curve or Pump AMM
- Uses `@pump-fun/pump-sdk` for bonding trades
- Uses `@pump-fun/pump-swap-sdk` for AMM trades
- Returns unsigned `TransactionInstruction[]` bundles for you to sign and submit yourself

## What it does not do

- It does not hold a private key
- It does not sign transactions
- It does not send transactions

## Usage

```ts
import { Keypair, Transaction } from "@solana/web3.js";
import { PumpTradeInstructionBuilder } from "pump-trader-v2";

const owner = Keypair.generate().publicKey;

const builder = new PumpTradeInstructionBuilder("https://api.mainnet-beta.solana.com", {
  defaultSlippageBps: 500,
});

const buyResult = await builder.createBuyInstructions({
  mint: "TOKEN_MINT_ADDRESS",
  owner,
  quoteAmountIn: 100_000_000n,
});

const tx = new Transaction().add(...buyResult.chunks[0].instructions);
```

## Sell example

```ts
const sellResult = await builder.createSellInstructions({
  mint: "TOKEN_MINT_ADDRESS",
  owner,
  tokenAmountIn: 1_000_000n,
});
```

## Lower-level API

```ts
const context = await builder.getTradeContext("TOKEN_MINT_ADDRESS");
const marketInfo = await builder.getMarketInfo("TOKEN_MINT_ADDRESS");

console.log(context.mode); // "bonding" | "amm"
console.log(marketInfo.solAmount.toString());
console.log(marketInfo.tokenAmount.toString());
```

## Notes

- `createBuyInstructions` and `createSellInstructions` may return multiple chunks when `maxAmountPerTx` is set
- Each chunk is already ordered for execution
- For AMM trades, setup and cleanup instructions are currently returned inline in `instructions`
- `getMarketInfo()` returns the current mode plus pool/bonding SOL and token reserves
- `PumpTradeInstructionBuilder` accepts either a `Connection` instance or an RPC string

## Quick market test

```bash
RPC_URL=https://api.mainnet-beta.solana.com \
MINT=TOKEN_MINT_ADDRESS \
npm run example:market
```

Or:

```bash
npm run example:market -- https://api.mainnet-beta.solana.com TOKEN_MINT_ADDRESS
```

This will print:

```json
{
  "mint": "...",
  "mode": "bonding",
  "tokenAmount": "...",
  "solAmount": "...",
  "virtualTokenAmount": "...",
  "virtualSolAmount": "..."
}
```

## Example scripts

Use these to isolate where a failure happens:

```bash
# 1. Only detect bonding / amm
npm run example:context -- <rpc> <mint>

# 2. Query market reserves
npm run example:market -- <rpc> <mint>

# 3. Diagnose context + market lookup
npm run example:diagnose -- <rpc> <mint>

# 4. Build buy instructions
npm run example:buy -- <rpc> <mint> <owner> <lamports> [slippageBps] [maxAmountPerTx]

# 5. Build sell instructions
npm run example:sell -- <rpc> <mint> <owner> <tokenBaseUnits> [slippageBps] [maxAmountPerTx]
```

All example scripts also support environment variables:

```bash
RPC_URL=... MINT=... OWNER=... AMOUNT=... npm run example:buy
```

The buy/sell examples print per-chunk diagnostics only:

```json
{
  "mode": "amm",
  "chunks": [
    {
      "index": 0,
      "instructionCount": 3,
      "cleanupInstructionCount": 0,
      "signerCount": 0,
      "inputAmount": "100000000",
      "expectedOutputAmount": "123456789"
    }
  ]
}
```
