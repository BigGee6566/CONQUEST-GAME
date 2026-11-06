// Raised when a move breaks the rules of the game (wrong turn, too few soldiers, ...).
// The HTTP layer maps it to 422 so the player sees the message as-is.
export class GameRuleError extends Error {
  constructor(code, message) {
    super(message);
    this.name = 'GameRuleError';
    this.code = code;
  }
}

export function assertPositiveInteger(value, label) {
  if (!Number.isInteger(value) || value < 1) {
    throw new GameRuleError('INVALID_AMOUNT', `${label} must be a whole number of at least 1`);
  }
}
