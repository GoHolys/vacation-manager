import type { EntityManager, Repository } from 'typeorm';
import type { UserCredentials, UserRepository } from '../application/user.repository';
import { User } from '../domain/user';
import type { UserRole } from '../domain/user-role';
import { toUser, UserRecord } from './user.record';

export class TypeOrmUserRepository implements UserRepository {
  private readonly repository: Repository<UserRecord>;

  constructor(manager: EntityManager) {
    this.repository = manager.getRepository(UserRecord);
  }

  async findById(id: string): Promise<User | null> {
    const record = await this.repository.findOneBy({ id });
    return record ? toUser(record) : null;
  }

  async findCredentialsByEmail(email: string): Promise<UserCredentials | null> {
    const record = await this.repository
      .createQueryBuilder('user')
      .addSelect('user.password')
      .where('user.email = :email', { email: User.normalizeEmail(email) })
      .getOne();
    return record ? { user: toUser(record), passwordHash: record.password } : null;
  }

  async list(filter: { role?: UserRole } = {}): Promise<User[]> {
    const query = this.repository.createQueryBuilder('user').orderBy('user.name', 'ASC');
    if (filter.role) query.where('user.role = :role', { role: filter.role });
    return (await query.getMany()).map(toUser);
  }
}
