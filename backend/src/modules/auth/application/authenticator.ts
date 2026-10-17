import { UnauthorizedError } from '../../../core/errors';
import type { UserRepository } from '../../users/application/user.repository';
import type { Principal, TokenService } from './ports';

/**
 * Resolves the caller from an `Authorization: Bearer <jwt>` header.
 *
 * The token signature proves identity, but the role is re-read from the database on every
 * request so that role changes and deleted accounts take effect immediately — not when the
 * token expires.
 */
export class Authenticator {
  constructor(
    private readonly tokens: TokenService,
    private readonly users: UserRepository,
  ) {}

  async authenticate(authorizationHeader: string | undefined): Promise<Principal> {
    if (!authorizationHeader) {
      throw new UnauthorizedError('Missing bearer token', 'MISSING_TOKEN');
    }
    const [scheme, token, ...rest] = authorizationHeader.trim().split(/\s+/);
    if (scheme?.toLowerCase() !== 'bearer' || !token || rest.length > 0) {
      throw new UnauthorizedError('Malformed Authorization header', 'INVALID_TOKEN');
    }

    const claims = this.tokens.verify(token);
    const user = await this.users.findById(claims.sub);
    if (!user) {
      throw new UnauthorizedError('This account no longer exists', 'INVALID_TOKEN');
    }
    return { id: user.id, name: user.name, email: user.email, role: user.role };
  }
}
