import { QueryFailedError } from 'typeorm';

/** PostgreSQL SQLSTATE codes we translate into domain errors. */
export const PgErrorCode = {
  UNIQUE_VIOLATION: '23505',
  CHECK_VIOLATION: '23514',
  EXCLUSION_VIOLATION: '23P01',
} as const;

export function isPgError(error: unknown, code: string, constraint?: string): boolean {
  if (!(error instanceof QueryFailedError)) return false;
  const driverError = error.driverError as { code?: string; constraint?: string } | undefined;
  return driverError?.code === code && (!constraint || driverError.constraint === constraint);
}
