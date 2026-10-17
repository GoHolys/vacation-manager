import jwt from 'jsonwebtoken';
import { beforeEach, describe, expect, it } from 'vitest';
import { FixedClock } from '../../../src/core/clock';
import { Authenticator } from '../../../src/modules/auth/application/authenticator';
import {
  AuthenticateUserCommand,
  AuthenticateUserHandler,
} from '../../../src/modules/auth/application/commands/authenticate-user.command';
import { BcryptPasswordHasher } from '../../../src/modules/auth/infrastructure/bcrypt-password-hasher';
import { InMemoryLoginAttemptLimiter } from '../../../src/modules/auth/infrastructure/in-memory-login-attempt-limiter';
import { JwtTokenService } from '../../../src/modules/auth/infrastructure/jwt-token.service';
import { UserRole } from '../../../src/modules/users/domain/user-role';
import { InMemoryUserRepository, makeUser } from '../../support/in-memory';

const JWT = {
  secret: 'unit-test-secret-unit-test-secret-1234',
  expiresIn: '1h',
  issuer: 'api',
  audience: 'web',
};

describe('authentication', () => {
  const hasher = new BcryptPasswordHasher(4);
  const tokens = new JwtTokenService(JWT);
  let clock: FixedClock;
  let users: InMemoryUserRepository;
  let handler: AuthenticateUserHandler;

  beforeEach(async () => {
    clock = new FixedClock(new Date('2030-01-15T10:00:00Z'));
    const user = makeUser(UserRole.REQUESTER, {
      email: 'jane@example.com',
      password: await hasher.hash('correct horse'),
    });
    users = new InMemoryUserRepository([user]);
    handler = new AuthenticateUserHandler(
      users,
      hasher,
      tokens,
      new InMemoryLoginAttemptLimiter({ maxAttempts: 3, windowMs: 15 * 60_000 }, clock),
    );
  });

  const login = (email: string, password: string) =>
    handler.execute(new AuthenticateUserCommand(email, password));

  it('issues a bearer token for valid credentials (case-insensitive e-mail)', async () => {
    const session = await login('  JANE@example.com ', 'correct horse');
    expect(session.tokenType).toBe('Bearer');
    expect(session.user).toMatchObject({ email: 'jane@example.com', role: 'requester' });
    expect(session.user).not.toHaveProperty('password');
    expect(tokens.verify(session.accessToken)).toMatchObject({
      sub: session.user.id,
      role: 'requester',
    });
  });

  it('uses the same error for a wrong password and an unknown e-mail', async () => {
    const wrongPassword = login('jane@example.com', 'nope').catch((error: unknown) => error);
    const unknownUser = login('ghost@example.com', 'nope').catch((error: unknown) => error);
    for (const error of await Promise.all([wrongPassword, unknownUser])) {
      expect(error).toMatchObject({ code: 'INVALID_CREDENTIALS', status: 401 });
    }
  });

  it('locks the account after repeated failures, then unlocks after the cool-down', async () => {
    for (let i = 0; i < 3; i++) await login('jane@example.com', 'nope').catch(() => undefined);

    await expect(login('jane@example.com', 'correct horse')).rejects.toMatchObject({
      code: 'LOGIN_LOCKED',
      status: 429,
    });

    clock.set(new Date('2030-01-15T10:16:00Z'));
    await expect(login('jane@example.com', 'correct horse')).resolves.toHaveProperty('accessToken');
  });

  it('scopes the lock to the client when its IP is known (no lock-out by strangers)', async () => {
    const attacker = (password: string) =>
      handler.execute(new AuthenticateUserCommand('jane@example.com', password, '203.0.113.9'));
    for (let i = 0; i < 3; i++) await attacker('nope').catch(() => undefined);

    await expect(attacker('correct horse')).rejects.toMatchObject({ code: 'LOGIN_LOCKED' });
    // The real owner, from another address, is unaffected.
    await expect(
      handler.execute(
        new AuthenticateUserCommand('jane@example.com', 'correct horse', '198.51.100.7'),
      ),
    ).resolves.toHaveProperty('accessToken');
  });

  describe('Authenticator', () => {
    it('resolves the principal from a valid bearer token', async () => {
      const session = await login('jane@example.com', 'correct horse');
      const principal = await new Authenticator(tokens, users).authenticate(
        `Bearer ${session.accessToken}`,
      );
      expect(principal).toMatchObject({ email: 'jane@example.com', role: 'requester' });
    });

    it.each([
      [undefined, 'MISSING_TOKEN'],
      ['Basic abc', 'INVALID_TOKEN'],
      ['Bearer not-a-jwt', 'INVALID_TOKEN'],
    ])('rejects the header %s', async (header, code) => {
      await expect(new Authenticator(tokens, users).authenticate(header)).rejects.toMatchObject({
        code,
        status: 401,
      });
    });

    it('rejects tokens signed with another secret, expired tokens and alg=none', async () => {
      const authenticator = new Authenticator(tokens, users);
      const [user] = users.users;
      const forged = jwt.sign(
        { role: 'validator', name: 'x', email: 'x' },
        'another-secret-another-secret-123',
        {
          subject: user!.id,
          issuer: 'api',
          audience: 'web',
        },
      );
      const expired = jwt.sign({ role: 'requester', name: 'x', email: 'x', exp: 1 }, JWT.secret, {
        subject: user!.id,
        issuer: 'api',
        audience: 'web',
      });
      const unsigned = jwt.sign({ role: 'validator', name: 'x', email: 'x' }, '', {
        algorithm: 'none',
        subject: user!.id,
        issuer: 'api',
        audience: 'web',
      });

      await expect(authenticator.authenticate(`Bearer ${forged}`)).rejects.toMatchObject({
        code: 'INVALID_TOKEN',
      });
      await expect(authenticator.authenticate(`Bearer ${expired}`)).rejects.toMatchObject({
        code: 'TOKEN_EXPIRED',
      });
      await expect(authenticator.authenticate(`Bearer ${unsigned}`)).rejects.toMatchObject({
        code: 'INVALID_TOKEN',
      });
    });

    it('rejects tokens of deleted accounts', async () => {
      const session = await login('jane@example.com', 'correct horse');
      users.users.length = 0;
      await expect(
        new Authenticator(tokens, users).authenticate(`Bearer ${session.accessToken}`),
      ).rejects.toMatchObject({
        code: 'INVALID_TOKEN',
      });
    });
  });
});
