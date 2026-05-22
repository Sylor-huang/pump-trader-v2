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
import { Connection, Keypair, Transaction } from "@solana/web3.js";
import { PumpTradeInstructionBuilder } from "pump-trader-v2";

const connection = new Connection("https://api.mainnet-beta.solana.com", "confirmed");
const owner = Keypair.generate().publicKey;

const builder = new PumpTradeInstructionBuilder(connection, {
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
