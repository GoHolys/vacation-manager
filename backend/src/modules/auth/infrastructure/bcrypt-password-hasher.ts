import bcrypt from 'bcryptjs';
import type { PasswordHasher } from '../application/ports';

/** bcryptjs is pure JavaScript: no native build step, works identically on Windows/macOS/Linux. */
export class BcryptPasswordHasher implements PasswordHasher {
  constructor(private readonly rounds: number) {}

  hash(plain: string): Promise<string> {
    return bcrypt.hash(plain, this.rounds);
  }

  verify(plain: string, hash: string): Promise<boolean> {
    return bcrypt.compare(plain, hash);
  }
}
