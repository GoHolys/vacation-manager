import type { Clock } from '../../../core/clock';
import { TooManyRequestsError } from '../../../core/errors';
import type { LoginAttemptLimiter } from '../application/ports';

interface AttemptState {
  failures: number;
  /** When the current counting window started. */
  windowStartedAt: number;
  lockedUntil: number | null;
}

export interface LoginAttemptLimiterOptions {
  /** Failures allowed within `windowMs` before the key is locked. */
  maxAttempts: number;
  /** Length of the counting window and of the lock-out. */
  windowMs: number;
  /** Upper bound on tracked keys, so the map cannot be grown without limit by an attacker. */
  maxTrackedKeys?: number;
}

/**
 * Fixed-window brute-force protection: N failures within the window lock the key for the same
 * duration. Old failures expire with their window, so occasional typos never add up to a lock.
 *
 * State lives in process memory and is bounded — fine for a single instance. For horizontally
 * scaled or serverless deployments, back this port with Redis/DynamoDB (see README).
 */
export class InMemoryLoginAttemptLimiter implements LoginAttemptLimiter {
  private readonly attempts = new Map<string, AttemptState>();
  private readonly maxTrackedKeys: number;

  constructor(
    private readonly options: LoginAttemptLimiterOptions,
    private readonly clock: Clock,
  ) {
    this.maxTrackedKeys = options.maxTrackedKeys ?? 10_000;
  }

  assertAllowed(key: string): void {
    const state = this.current(key);
    if (!state?.lockedUntil) return;

    const retryAfterSeconds = Math.ceil((state.lockedUntil - this.now()) / 1000);
    throw new TooManyRequestsError(
      `Too many failed login attempts. Try again in ${Math.ceil(retryAfterSeconds / 60)} minute(s).`,
      retryAfterSeconds,
      'LOGIN_LOCKED',
    );
  }

  recordFailure(key: string): void {
    const now = this.now();
    const state = this.current(key) ?? { failures: 0, windowStartedAt: now, lockedUntil: null };
    state.failures += 1;
    if (state.failures >= this.options.maxAttempts) {
      state.lockedUntil = now + this.options.windowMs;
    }
    // Re-insert so Map iteration order reflects recency (oldest entries are evicted first).
    this.attempts.delete(key);
    this.attempts.set(key, state);
    this.enforceCapacity();
  }

  reset(key: string): void {
    this.attempts.delete(key);
  }

  /** Number of tracked keys (exposed for tests and metrics). */
  get size(): number {
    return this.attempts.size;
  }

  /** Returns the live state for a key, dropping it once its window and lock have expired. */
  private current(key: string): AttemptState | undefined {
    const state = this.attempts.get(key);
    if (state && this.isExpired(state, this.now())) {
      this.attempts.delete(key);
      return undefined;
    }
    return state;
  }

  private isExpired(state: AttemptState, now: number): boolean {
    if (state.lockedUntil !== null) return state.lockedUntil <= now;
    return now - state.windowStartedAt >= this.options.windowMs;
  }

  private enforceCapacity(): void {
    if (this.attempts.size <= this.maxTrackedKeys) return;
    const now = this.now();
    for (const [key, state] of this.attempts) {
      if (this.isExpired(state, now)) this.attempts.delete(key);
    }
    // Still over capacity: evict the least recently failed keys.
    for (const key of this.attempts.keys()) {
      if (this.attempts.size <= this.maxTrackedKeys) break;
      this.attempts.delete(key);
    }
  }

  private now(): number {
    return this.clock.now().getTime();
  }
}
