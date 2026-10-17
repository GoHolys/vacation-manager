import jwt, { type JwtPayload, type SignOptions } from 'jsonwebtoken';
import { UnauthorizedError } from '../../../core/errors';
import { isUserRole } from '../../users/domain/user-role';
import type { AccessTokenClaims, IssuedToken, TokenService } from '../application/ports';

export interface JwtOptions {
  secret: string;
  expiresIn: string;
  issuer: string;
  audience: string;
}

const ALGORITHM = 'HS256';

export class JwtTokenService implements TokenService {
  constructor(private readonly options: JwtOptions) {}

  issue({ sub, ...claims }: AccessTokenClaims): IssuedToken {
    const token = jwt.sign(claims, this.options.secret, {
      algorithm: ALGORITHM,
      subject: sub,
      expiresIn: this.options.expiresIn as SignOptions['expiresIn'],
      issuer: this.options.issuer,
      audience: this.options.audience,
    });
    const { iat = 0, exp = 0 } = jwt.decode(token) as JwtPayload;
    return { token, expiresAt: new Date(exp * 1000), expiresIn: exp - iat };
  }

  verify(token: string): AccessTokenClaims {
    let payload: JwtPayload;
    try {
      payload = jwt.verify(token, this.options.secret, {
        algorithms: [ALGORITHM], // never accept `alg: none` or algorithm confusion
        issuer: this.options.issuer,
        audience: this.options.audience,
      }) as JwtPayload;
    } catch (error) {
      if (error instanceof jwt.TokenExpiredError) {
        throw new UnauthorizedError(
          'Your session has expired, please sign in again',
          'TOKEN_EXPIRED',
        );
      }
      throw new UnauthorizedError('Invalid access token', 'INVALID_TOKEN');
    }

    const { sub, role, name, email } = payload;
    if (
      typeof sub !== 'string' ||
      !isUserRole(role) ||
      typeof name !== 'string' ||
      typeof email !== 'string'
    ) {
      throw new UnauthorizedError('Invalid access token', 'INVALID_TOKEN');
    }
    return { sub, role, name, email };
  }
}
