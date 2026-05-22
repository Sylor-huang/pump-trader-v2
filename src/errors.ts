export class InvalidTradeInputError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "InvalidTradeInputError";
  }
}

export class TradeContextDetectionError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "TradeContextDetectionError";
  }
}

export class UnsupportedPumpMintError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "UnsupportedPumpMintError";
  }
}

export class BondingStateFetchError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "BondingStateFetchError";
  }
}

export class AmmPoolNotFoundError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "AmmPoolNotFoundError";
  }
}

export class InstructionBuildError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "InstructionBuildError";
  }
}
