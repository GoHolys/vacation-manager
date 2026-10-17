import type { User } from '../domain/user';
import type { UserRole } from '../domain/user-role';

/** A user together with their password hash — only ever loaded to authenticate. */
export interface UserCredentials {
  user: User;
  passwordHash: string;
}

/** Persistence port for users (implemented in infrastructure, faked in unit tests). */
export interface UserRepository {
  findById(id: string): Promise<User | null>;
  /** For authentication only: the user *and* their password hash. */
  findCredentialsByEmail(email: string): Promise<UserCredentials | null>;
  list(filter?: { role?: UserRole }): Promise<User[]>;
}
