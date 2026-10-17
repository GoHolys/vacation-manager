import { describe, expect, it } from 'vitest';
import { FixedClock } from '../../../src/core/clock';
import { InMemoryLoginAttemptLimiter } from '../../../src/modules/auth/infrastructure/in-memory-login-attempt-limiter';

const MINUTE = 60_000;

const setup = (maxTrackedKeys?: number) => {
  const clock = new FixedClock(new Date('2030-01-15T10:00:00Z'));
  const limiter = new InMemoryLoginAttemptLimiter(
    { maxAttempts: 3, windowMs: 15 * MINUTE, maxTrackedKeys },
    clock,
  );
  const advance = (ms: number) => clock.set(new Date(clock.now().getTime() + ms));
  return { limiter, advance };
};

describe('InMemoryLoginAttemptLimiter', () => {
  it('locks a key after N failures within the window, then unlocks', () => {
    const { limiter, advance } = setup();
    for (let i = 0; i < 3; i++) limiter.recordFailure('a');
    expect(() => limiter.assertAllowed('a')).toThrow(
      expect.objectContaining({ code: 'LOGIN_LOCKED' }),
    );
    expect(() => limiter.assertAllowed('b')).not.toThrow();

    advance(15 * MINUTE);
    expect(() => limiter.assertAllowed('a')).not.toThrow();
  });

  it('forgets failures from an expired window (occasional typos never add up)', () => {
    const { limiter, advance } = setup();
    limiter.recordFailure('a');
    limiter.recordFailure('a');
    advance(16 * MINUTE);
    limiter.recordFailure('a');
    expect(() => limiter.assertAllowed('a')).not.toThrow();
  });

  it('reports the remaining lock time', () => {
    const { limiter, advance } = setup();
    for (let i = 0; i < 3; i++) limiter.recordFailure('a');
    advance(5 * MINUTE);
    expect(() => limiter.assertAllowed('a')).toThrow(
      expect.objectContaining({ retryAfterSeconds: 10 * 60 }),
    );
  });

  it('stays bounded in memory, evicting expired then least-recent keys', () => {
    const { limiter, advance } = setup(100);
    for (let i = 0; i < 100; i++) limiter.recordFailure(`old-${i}`);
    advance(20 * MINUTE); // all expired
    for (let i = 0; i < 150; i++) limiter.recordFailure(`new-${i}`);
    expect(limiter.size).toBeLessThanOrEqual(100);
  });
});
