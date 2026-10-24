export class ApplicationError extends Error {
  override readonly name: string = 'ApplicationError';
}

export class UnavailableError extends ApplicationError {
  override readonly name = 'UnavailableError';

  constructor(
    readonly service: string,
    message: string,
    options?: ErrorOptions,
  ) {
    super(message, options);
  }
}

export class UnusableReplyError extends ApplicationError {
  override readonly name = 'UnusableReplyError';

  constructor(
    readonly service: string,
    message: string,
  ) {
    super(message);
  }
}

export class VaultRefusedError extends ApplicationError {
  override readonly name = 'VaultRefusedError';
}

export class NotFoundError extends ApplicationError {
  override readonly name = 'NotFoundError';
}

export class NotSparrableError extends ApplicationError {
  override readonly name = 'NotSparrableError';
}

export class ChallengeLeakError extends ApplicationError {
  override readonly name = 'ChallengeLeakError';
}

export class PayloadMismatchError extends ApplicationError {
  override readonly name = 'PayloadMismatchError';
}
