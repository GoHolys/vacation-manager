import { Query, type QueryHandler } from '../../../../core/cqrs/query-bus';
import type { StatusCounts, VacationRequestReadModel } from '../ports';

export type VacationRequestStatsDto = StatusCounts & { total: number };

/** Counts per status — for everyone (validator) or for a single user (requester). */
export class GetVacationRequestStatsQuery extends Query<VacationRequestStatsDto> {
  constructor(readonly userId?: string) {
    super();
  }
}

export class GetVacationRequestStatsHandler implements QueryHandler<GetVacationRequestStatsQuery> {
  constructor(private readonly readModel: VacationRequestReadModel) {}

  async execute({ userId }: GetVacationRequestStatsQuery): Promise<VacationRequestStatsDto> {
    const counts = await this.readModel.countByStatus(userId);
    return { ...counts, total: counts.pending + counts.approved + counts.rejected };
  }
}
