export class DomainError extends Error {
  override readonly name: string = 'DomainError';
}

export class SparringRoundError extends DomainError {
  override readonly name = 'SparringRoundError';
}

export class ChallengeQuotesNoteError extends DomainError {
  override readonly name = 'ChallengeQuotesNoteError';
}

export class InvalidTier2PayloadError extends DomainError {
  override readonly name = 'InvalidTier2PayloadError';
}
