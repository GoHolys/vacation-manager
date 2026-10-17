import { Query, type QueryHandler } from '../../../../core/cqrs/query-bus';
import { UserRole } from '../../../users/domain/user-role';
import { VacationRequestErrors } from '../../domain/vacation-request.errors';
import type { VacationRequestReadModel } from '../ports';
import { toVacationRequestDto, type VacationRequestDto } from '../vacation-request.dto';

export interface Viewer {
  id: string;
  role: UserRole;
}

export class GetVacationRequestQuery extends Query<VacationRequestDto> {
  constructor(
    readonly requestId: string,
    readonly viewer: Viewer,
  ) {
    super();
  }
}

export class GetVacationRequestHandler implements QueryHandler<GetVacationRequestQuery> {
  constructor(private readonly readModel: VacationRequestReadModel) {}

  async execute({ requestId, viewer }: GetVacationRequestQuery): Promise<VacationRequestDto> {
    const request = await this.readModel.findById(requestId);
    // Requesters may only see their own requests; respond 404 rather than 403 to avoid
    // disclosing the existence of other people's requests.
    if (!request || (viewer.role === UserRole.REQUESTER && request.userId !== viewer.id)) {
      throw VacationRequestErrors.notFound();
    }
    return toVacationRequestDto(request);
  }
}
