import type { DataSource, SelectQueryBuilder } from 'typeorm';
import type { IsoDate } from '../../../core/iso-date';
import { type PageRequest, toOffset } from '../../../core/pagination';
import type {
  StatusCounts,
  VacationRequestListCriteria,
  VacationRequestReadModel,
  VacationRequestView,
} from '../application/ports';
import { VacationRequest } from '../domain/vacation-request.entity';
import { BLOCKING_STATUSES, VacationRequestStatus } from '../domain/vacation-request-status';

const SORT_COLUMNS = {
  createdAt: 'request.createdAt',
  startDate: 'request.startDate',
} as const;

/**
 * Query-side persistence. Joins only what the views need and pushes filtering, ordering,
 * counting and pagination down to PostgreSQL (backed by the composite indexes of the migration).
 */
export class TypeOrmVacationRequestReadModel implements VacationRequestReadModel {
  constructor(private readonly dataSource: DataSource) {}

  private baseQuery(): SelectQueryBuilder<VacationRequest> {
    return this.dataSource
      .getRepository(VacationRequest)
      .createQueryBuilder('request')
      .innerJoinAndSelect('request.user', 'user')
      .leftJoinAndSelect('request.decidedBy', 'decidedBy');
  }

  async findById(id: string): Promise<VacationRequestView | null> {
    const request = await this.baseQuery().where('request.id = :id', { id }).getOne();
    return request as VacationRequestView | null;
  }

  async list(criteria: VacationRequestListCriteria, page: PageRequest) {
    const query = this.baseQuery();
    if (criteria.userId) query.andWhere('request.userId = :userId', { userId: criteria.userId });
    if (criteria.status) query.andWhere('request.status = :status', { status: criteria.status });

    const direction = criteria.order === 'asc' ? 'ASC' : 'DESC';
    query
      .orderBy(SORT_COLUMNS[criteria.sort], direction)
      // Deterministic ordering across pages when the sort key has ties.
      .addOrderBy('request.id', direction)
      .skip(toOffset(page))
      .take(page.pageSize);

    const [items, total] = await query.getManyAndCount();
    return { items: items as VacationRequestView[], total };
  }

  async countByStatus(userId?: string): Promise<StatusCounts> {
    const query = this.dataSource
      .getRepository(VacationRequest)
      .createQueryBuilder('request')
      .select('request.status', 'status')
      .addSelect('COUNT(*)::int', 'count')
      .groupBy('request.status');
    if (userId) query.where('request.userId = :userId', { userId });

    const rows = await query.getRawMany<{ status: VacationRequestStatus; count: number }>();
    const counts: StatusCounts = {
      [VacationRequestStatus.PENDING]: 0,
      [VacationRequestStatus.APPROVED]: 0,
      [VacationRequestStatus.REJECTED]: 0,
    };
    for (const row of rows) counts[row.status] = Number(row.count);
    return counts;
  }

  findBlockingInRange(from: IsoDate, to: IsoDate): Promise<VacationRequest[]> {
    return (
      this.dataSource
        .getRepository(VacationRequest)
        .createQueryBuilder('request')
        .where('request.status IN (:...statuses)', { statuses: BLOCKING_STATUSES })
        // Same expression as the exclusion constraint, so its GiST index can serve this query.
        .andWhere(
          `daterange(request.startDate, request.endDate, '[]') && daterange(CAST(:from AS date), CAST(:to AS date), '[]')`,
          { from, to },
        )
        .orderBy('request.startDate', 'ASC')
        .getMany()
    );
  }
}
