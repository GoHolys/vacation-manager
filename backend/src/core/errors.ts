/**
 * Application error hierarchy.
 *
 * Every error that is *expected* (bad input, missing permission, broken business rule…)
 * is an `AppError` carrying an HTTP status and a stable, machine-readable `code`.
 * The HTTP layer maps them to responses; anything else is treated as a 500.
 */
export interface ErrorDetail {
  field?: string;
  message: string;
  [key: string]: unknown;
}

export abstract class AppError extends Error {
  abstract readonly status: number;
  readonly code: string;
  readonly details?: ErrorDetail[];

  protected constructor(code: string, message: string, details?: ErrorDetail[]) {
    super(message);
    this.name = new.target.name;
    this.code = code;
    this.details = details;
  }
}

export class BadRequestError extends AppError {
  readonly status = 400;
  constructor(message = 'Bad request', code = 'BAD_REQUEST') {
    super(code, message);
  }
}

export class ValidationError extends AppError {
  readonly status = 422;
  constructor(details: ErrorDetail[], message = 'The request contains invalid data') {
    super('VALIDATION_ERROR', message, details);
  }
}

export class UnauthorizedError extends AppError {
  readonly status = 401;
  constructor(message = 'Authentication is required', code = 'UNAUTHORIZED') {
    super(code, message);
  }
}

export class ForbiddenError extends AppError {
  readonly status = 403;
  constructor(message = 'You are not allowed to perform this action', code = 'FORBIDDEN') {
    super(code, message);
  }
}

export class NotFoundError extends AppError {
  readonly status = 404;
  constructor(message = 'Resource not found', code = 'NOT_FOUND') {
    super(code, message);
  }
}

export class ConflictError extends AppError {
  readonly status = 409;
  constructor(code: string, message: string, details?: ErrorDetail[]) {
    super(code, message, details);
  }
}

/** A domain invariant was violated by otherwise well-formed input. */
export class BusinessRuleViolationError extends AppError {
  readonly status = 422;
  constructor(code: string, message: string, details?: ErrorDetail[]) {
    super(code, message, details);
  }
}

export class PayloadTooLargeError extends AppError {
  readonly status = 413;
  constructor(message = 'Payload too large') {
    super('PAYLOAD_TOO_LARGE', message);
  }
}

export class UnsupportedMediaTypeError extends AppError {
  readonly status = 415;
  constructor(message = 'Unsupported media type') {
    super('UNSUPPORTED_MEDIA_TYPE', message);
  }
}

export class ServiceUnavailableError extends AppError {
  readonly status = 503;
  constructor(message = 'The service is temporarily unavailable. Please try again shortly.') {
    super('SERVICE_UNAVAILABLE', message);
  }
}

export class TooManyRequestsError extends AppError {
  readonly status = 429;
  constructor(
    message: string,
    readonly retryAfterSeconds: number,
    code = 'TOO_MANY_REQUESTS',
  ) {
    super(code, message);
  }
}
