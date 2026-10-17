import type { EntityManager, Repository } from 'typeorm';
import type { UserRepository } from '../application/user.repository';
import { User } from '../domain/user.entity';
import type { UserRole } from '../domain/user-role';

export class TypeOrmUserRepository implements UserRepository {
  private readonly repository: Repository<User>;

  constructor(manager: EntityManager) {
    this.repository = manager.getRepository(User);
  }

  findById(id: string): Promise<User | null> {
    return this.repository.findOneBy({ id });
  }

  findByEmailWithPassword(email: string): Promise<User | null> {
    return this.repository
      .createQueryBuilder('user')
      .addSelect('user.password')
      .where('user.email = :email', { email: User.normalizeEmail(email) })
      .getOne();
  }

  list(filter: { role?: UserRole } = {}): Promise<User[]> {
    const query = this.repository.createQueryBuilder('user').orderBy('user.name', 'ASC');
    if (filter.role) query.where('user.role = :role', { role: filter.role });
    return query.getMany();
  }
}
