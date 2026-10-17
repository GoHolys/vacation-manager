import type { Clock } from '../../../core/clock';
import { TooManyRequestsError } from '../../../core/errors';
import type { LoginAttemptLimiter } from '../application/ports';

interface AttemptState {
  failures: number;
  lockedUntil: number | null;
}

/**
 * Locks an account identifier after N consecutive failed logins for a cool-down period.
 *
 * State lives in process memory — fine for a single instance. For horizontally scaled or
 * serverless deployments, back this port with Redis/DynamoDB (see README › Known limitations).
 */
export class InMemoryLoginAttemptLimiter implements LoginAttemptLimiter {
  private readonly attempts = new Map<string, AttemptState>();

  constructor(
    private readonly maxAttempts: number,
    private readonly lockoutMs: number,
    private readonly clock: Clock,
  ) {}

  assertAllowed(key: string): void {
    const state = this.attempts.get(key);
    if (!state?.lockedUntil) return;

    const remainingMs = state.lockedUntil - this.clock.now().getTime();
    if (remainingMs <= 0) {
      this.attempts.delete(key);
      return;
    }
    const retryAfterSeconds = Math.ceil(remainingMs / 1000);
    throw new TooManyRequestsError(
      `Too many failed login attempts. Try again in ${Math.ceil(retryAfterSeconds / 60)} minute(s).`,
      retryAfterSeconds,
      'LOGIN_LOCKED',
    );
  }

  recordFailure(key: string): void {
    const state = this.attempts.get(key) ?? { failures: 0, lockedUntil: null };
    state.failures += 1;
    if (state.failures >= this.maxAttempts) {
      state.lockedUntil = this.clock.now().getTime() + this.lockoutMs;
    }
    this.attempts.set(key, state);
  }

  reset(key: string): void {
    this.attempts.delete(key);
  }
}
