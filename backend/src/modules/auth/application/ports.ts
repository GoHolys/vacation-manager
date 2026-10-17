import type { UserRole } from '../../users/domain/user-role';

export interface PasswordHasher {
  hash(plain: string): Promise<string>;
  verify(plain: string, hash: string): Promise<boolean>;
}

export interface AccessTokenClaims {
  sub: string;
  role: UserRole;
  name: string;
  email: string;
}

export interface IssuedToken {
  token: string;
  expiresAt: Date;
  /** Lifetime in seconds. */
  expiresIn: number;
}

export interface TokenService {
  issue(claims: AccessTokenClaims): IssuedToken;
  /** @throws UnauthorizedError when the token is invalid or expired. */
  verify(token: string): AccessTokenClaims;
}

/** Brute-force protection for the login endpoint. */
export interface LoginAttemptLimiter {
  /** @throws TooManyRequestsError while the key is locked out. */
  assertAllowed(key: string): void;
  recordFailure(key: string): void;
  reset(key: string): void;
}

/** The authenticated caller of a request. */
export interface Principal {
  id: string;
  name: string;
  email: string;
  role: UserRole;
}
