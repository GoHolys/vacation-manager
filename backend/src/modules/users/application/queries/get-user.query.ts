import { NotFoundError } from '../../../../core/errors';
import { Query, type QueryHandler } from '../../../../core/cqrs/query-bus';
import { toUserDto, type UserDto } from '../user.dto';
import type { UserRepository } from '../user.repository';

export class GetUserQuery extends Query<UserDto> {
  constructor(readonly userId: string) {
    super();
  }
}

export class GetUserHandler implements QueryHandler<GetUserQuery> {
  constructor(private readonly users: UserRepository) {}

  async execute({ userId }: GetUserQuery): Promise<UserDto> {
    const user = await this.users.findById(userId);
    if (!user) throw new NotFoundError('User not found', 'USER_NOT_FOUND');
    return toUserDto(user);
  }
}
