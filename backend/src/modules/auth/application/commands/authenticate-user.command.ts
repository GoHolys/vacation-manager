import { Command, type CommandHandler } from '../../../../core/cqrs/command-bus';
import { UnauthorizedError } from '../../../../core/errors';
import type { UserRepository } from '../../../users/application/user.repository';
import { toUserDto, type UserDto } from '../../../users/application/user.dto';
import { User } from '../../../users/domain/user.entity';
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
  ) {
    super();
  }
}

export class AuthenticateUserHandler implements CommandHandler<AuthenticateUserCommand> {
  /**
   * Hash compared against when the e-mail is unknown, so the response time does not reveal
   * whether an account exists (user-enumeration protection). Computed once, lazily.
   */
  private dummyHash?: Promise<string>;

  constructor(
    private readonly users: UserRepository,
    private readonly hasher: PasswordHasher,
    private readonly tokens: TokenService,
    private readonly limiter: LoginAttemptLimiter,
  ) {}

  async execute(command: AuthenticateUserCommand): Promise<AuthenticationResultDto> {
    const email = User.normalizeEmail(command.email);
    this.limiter.assertAllowed(email);

    const user = await this.users.findByEmailWithPassword(email);
    const passwordMatches = await this.hasher.verify(
      command.password,
      user?.password ?? (await this.getDummyHash()),
    );

    if (!user || !passwordMatches) {
      this.limiter.recordFailure(email);
      // Same message for unknown e-mail and wrong password.
      throw new UnauthorizedError('Invalid email or password', 'INVALID_CREDENTIALS');
    }

    this.limiter.reset(email);
    const issued = this.tokens.issue({
      sub: user.id,
      role: user.role,
      name: user.name,
      email: user.email,
    });

    return {
      accessToken: issued.token,
      tokenType: 'Bearer',
      expiresIn: issued.expiresIn,
      expiresAt: issued.expiresAt.toISOString(),
      user: toUserDto(user),
    };
  }

  private getDummyHash(): Promise<string> {
    this.dummyHash ??= this.hasher.hash('timing-safe-dummy-password');
    return this.dummyHash;
  }
}
