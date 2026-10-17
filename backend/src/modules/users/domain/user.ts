import type { UserRole } from './user-role';

export interface UserProps {
  id: string;
  name: string;
  /** Always lower-cased (see `User.normalizeEmail`). */
  email: string;
  role: UserRole;
  createdAt: Date;
}

/**
 * A person who uses the application (requester or validator).
 *
 * Pure domain object: no persistence or framework concerns. The password hash is deliberately
 * not part of it — credentials are an authentication concern, loaded only by the login use case
 * (see `UserRepository.findCredentialsByEmail`), so they can never leak through a user object.
 */
export class User {
  private constructor(private readonly props: Readonly<UserProps>) {}

  /** Rebuilds a user from stored state. */
  static restore(props: UserProps): User {
    return new User({ ...props, email: User.normalizeEmail(props.email) });
  }

  static normalizeEmail(email: string): string {
    return email.trim().toLowerCase();
  }

  get id(): string {
    return this.props.id;
  }
  get name(): string {
    return this.props.name;
  }
  get email(): string {
    return this.props.email;
  }
  get role(): UserRole {
    return this.props.role;
  }
  get createdAt(): Date {
    return this.props.createdAt;
  }

  hasRole(role: UserRole): boolean {
    return this.props.role === role;
  }
}
