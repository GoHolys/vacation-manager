import { DomainEvent } from '../../../core/domain-event';
import type { UserRole } from '../../users/domain/user-role';

/**
 * Aggregate id used by `UserLoginFailedEvent` when the e-mail matches no account. Using a fixed
 * id (instead of skipping the event) keeps both failure paths identical in cost, so the response
 * time still does not reveal whether an account exists.
 */
export const UNKNOWN_ACCOUNT_ID = '00000000-0000-0000-0000-000000000000';

/** A user signed in successfully. */
export class UserLoggedInEvent extends DomainEvent<{
  userId: string;
  actorId: string;
  role: UserRole;
  clientIp: string | null;
}> {
  readonly eventName = 'user.logged-in';

  static of(user: { id: string; role: UserRole }, clientIp?: string): UserLoggedInEvent {
    return new UserLoggedInEvent(user.id, {
      userId: user.id,
      actorId: user.id,
      role: user.role,
      clientIp: clientIp ?? null,
    });
  }
}

/** A sign-in attempt failed (wrong password or unknown e-mail) — a security audit signal. */
export class UserLoginFailedEvent extends DomainEvent<{
  /** `null` when the e-mail matches no account. */
  userId: string | null;
  email: string;
  clientIp: string | null;
}> {
  readonly eventName = 'user.login-failed';

  static of(email: string, userId: string | null, clientIp?: string): UserLoginFailedEvent {
    return new UserLoginFailedEvent(userId ?? UNKNOWN_ACCOUNT_ID, {
      userId,
      email,
      clientIp: clientIp ?? null,
    });
  }
}
