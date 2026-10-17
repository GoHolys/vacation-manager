import { Query, type QueryHandler } from '../../../../core/cqrs/query-bus';
import { buildPage, type Page, type PageRequest } from '../../../../core/pagination';
import type { VacationRequestListCriteria, VacationRequestReadModel } from '../ports';
import { toVacationRequestDto, type VacationRequestDto } from '../vacation-request.dto';

/**
 * Paginated list of vacation requests. Used for both the requester view (criteria.userId is
 * forced to the caller by the HTTP layer) and the validator dashboard (all requests, filterable).
 */
export class ListVacationRequestsQuery extends Query<Page<VacationRequestDto>> {
  constructor(
    readonly criteria: VacationRequestListCriteria,
    readonly page: PageRequest,
  ) {
    super();
  }
}

export class ListVacationRequestsHandler implements QueryHandler<ListVacationRequestsQuery> {
  constructor(private readonly readModel: VacationRequestReadModel) {}

  async execute({ criteria, page }: ListVacationRequestsQuery): Promise<Page<VacationRequestDto>> {
    const { items, total } = await this.readModel.list(criteria, page);
    return buildPage(items.map(toVacationRequestDto), total, page);
  }
}
