import { Check, Column, CreateDateColumn, Entity, PrimaryGeneratedColumn, Unique } from 'typeorm';
import { USER_ROLES, type UserRole } from './user-role';

@Entity({ name: 'users' })
@Unique('uq_users_email', ['email'])
@Check('chk_users_email_lowercase', `"email" = lower("email")`)
export class User {
  @PrimaryGeneratedColumn('uuid', { primaryKeyConstraintName: 'pk_users' })
  id!: string;

  @Column({ type: 'varchar', length: 120 })
  name!: string;

  /** Always stored lower-cased (enforced by a CHECK constraint) so lookups are case-insensitive. */
  @Column({ type: 'varchar', length: 254 })
  email!: string;

  /** bcrypt hash — never selected unless explicitly requested. */
  @Column({ type: 'varchar', length: 255, select: false })
  password!: string;

  @Column({ type: 'enum', enum: USER_ROLES, enumName: 'user_role' })
  role!: UserRole;

  @CreateDateColumn({ name: 'created_at', type: 'timestamptz' })
  createdAt!: Date;

  hasRole(role: UserRole): boolean {
    return this.role === role;
  }

  static normalizeEmail(email: string): string {
    return email.trim().toLowerCase();
  }
}
