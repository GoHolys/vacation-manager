import { Query, type QueryHandler } from '../../../../core/cqrs/query-bus';
import type { UserRole } from '../../domain/user-role';
import { toUserDto, type UserDto } from '../user.dto';
import type { UserRepository } from '../user.repository';

export class ListUsersQuery extends Query<UserDto[]> {
  constructor(readonly role?: UserRole) {
    super();
  }
}

export class ListUsersHandler implements QueryHandler<ListUsersQuery> {
  constructor(private readonly users: UserRepository) {}

  async execute({ role }: ListUsersQuery): Promise<UserDto[]> {
    const users = await this.users.list(role ? { role } : {});
    return users.map(toUserDto);
  }
}
