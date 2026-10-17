import type { User } from '../domain/user.entity';
import type { UserRole } from '../domain/user-role';

/** Persistence port for users (implemented in infrastructure, faked in unit tests). */
export interface UserRepository {
  findById(id: string): Promise<User | null>;
  /** Returns the user *including* the password hash — for authentication only. */
  findByEmailWithPassword(email: string): Promise<User | null>;
  list(filter?: { role?: UserRole }): Promise<User[]>;
}
