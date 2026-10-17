import { Check, Column, CreateDateColumn, Entity, PrimaryGeneratedColumn, Unique } from 'typeorm';
import { User } from '../domain/user';
import { USER_ROLES, type UserRole } from '../domain/user-role';

/**
 * Persistence model of the `users` table (TypeORM mapping only, no behaviour).
 * The domain works with `User`; the repository translates between the two.
 */
@Entity({ name: 'users' })
@Unique('uq_users_email', ['email'])
@Check('chk_users_email_lowercase', `"email" = lower("email")`)
export class UserRecord {
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
}

export const toUser = (record: UserRecord): User =>
  User.restore({
    id: record.id,
    name: record.name,
    email: record.email,
    role: record.role,
    createdAt: record.createdAt,
  });
