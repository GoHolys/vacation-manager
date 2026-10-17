import { Command, type CommandHandler } from '../../../../core/cqrs/command-bus';
import type { EventPublisher } from '../../../../core/cqrs/event-bus';
import { UnauthorizedError } from '../../../../core/errors';
import type { UserRepository } from '../../../users/application/user.repository';
import { toUserDto, type UserDto } from '../../../users/application/user.dto';
import { User } from '../../../users/domain/user';
import { UserLoggedInEvent, UserLoginFailedEvent } from '../../domain/authentication.events';
import type { LoginAttemptLimiter, PasswordHasher, TokenService } from '../ports';

export interface AuthenticationResultDto {
  accessToken: string;
  tokenType: 'Bearer';
  expiresIn: number;
  expiresAt: string;
  user: UserDto;
}

export class AuthenticateUserCommand extends Command<AuthenticationResultDto> {
  constructor(
    readonly email: string,
    readonly password: string,
    /** Caller's IP when known (trusted proxy) — scopes brute-force throttling per client. */
    readonly clientIp?: string,
  ) {
    super();
  }
}

export class AuthenticateUserHandler implements CommandHandler<AuthenticateUserCommand> {
  /**
   * Hash compared against when the e-mail is unknown, so the response time does not reveal
   * whether an account exists (user-enumeration protection). Computed eagerly at start-up so
   * even the very first unknown-e-mail login takes the same time as a real one.
   */
  private readonly dummyHash: Promise<string>;

  constructor(
    private readonly users: UserRepository,
    private readonly hasher: PasswordHasher,
    private readonly tokens: TokenService,
    private readonly limiter: LoginAttemptLimiter,
    private readonly events: EventPublisher,
  ) {
    this.dummyHash = hasher.hash('timing-safe-dummy-password');
    this.dummyHash.catch(() => undefined); // surfaced (re-thrown) when awaited during a login
  }

  async execute(command: AuthenticateUserCommand): Promise<AuthenticationResultDto> {
    const email = User.normalizeEmail(command.email);
    // Per account *and* client when the client is known: a stranger hammering an e-mail address
    // cannot lock its owner out from their own machine. Without a trusted client IP, per account.
    const throttleKey = command.clientIp ? `${email}|${command.clientIp}` : email;
    this.limiter.assertAllowed(throttleKey);

    const credentials = await this.users.findCredentialsByEmail(email);
    const passwordMatches = await this.hasher.verify(
      command.password,
      credentials?.passwordHash ?? (await this.dummyHash),
    );

    if (!credentials || !passwordMatches) {
      this.limiter.recordFailure(throttleKey);
      // Published on both paths (unknown e-mail and wrong password) so they cost the same time.
      await this.events.publish(
        UserLoginFailedEvent.of(email, credentials?.user.id ?? null, command.clientIp),
      );
      // Same message for unknown e-mail and wrong password.
      throw new UnauthorizedError('Invalid email or password', 'INVALID_CREDENTIALS');
    }

    const { user } = credentials;
    this.limiter.reset(throttleKey);
    const issued = this.tokens.issue({
      sub: user.id,
      role: user.role,
      name: user.name,
      email: user.email,
    });
    await this.events.publish(UserLoggedInEvent.of(user, command.clientIp));

    return {
      accessToken: issued.token,
      tokenType: 'Bearer',
      expiresIn: issued.expiresIn,
      expiresAt: issued.expiresAt.toISOString(),
      user: toUserDto(user),
    };
  }
}
