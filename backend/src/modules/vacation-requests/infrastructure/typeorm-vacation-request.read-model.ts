import type { DataSource, SelectQueryBuilder } from 'typeorm';
import type { IsoDate } from '../../../core/iso-date';
import { type PageRequest, toOffset } from '../../../core/pagination';
import type { UserRecord } from '../../users/infrastructure/user.record';
import type {
  CalendarEntryView,
  StatusCounts,
  UserSummaryView,
  VacationRequestListCriteria,
  VacationRequestReadModel,
  VacationRequestView,
} from '../application/ports';
import { BLOCKING_STATUSES, VacationRequestStatus } from '../domain/vacation-request-status';
import { VacationRequestRecord } from './vacation-request.record';

const SORT_COLUMNS = {
  createdAt: 'request.createdAt',
  startDate: 'request.startDate',
} as const;

const toUserSummary = ({ id, name, email }: UserRecord): UserSummaryView => ({ id, name, email });

const toView = (record: VacationRequestRecord): VacationRequestView => {
  if (!record.user) throw new Error('Read model invariant: the requester relation was not loaded');
  return {
    id: record.id,
    userId: record.userId,
    startDate: record.startDate,
    endDate: record.endDate,
    reason: record.reason,
    status: record.status,
    comments: record.comments,
    decidedAt: record.decidedAt,
    createdAt: record.createdAt,
    updatedAt: record.updatedAt,
    user: toUserSummary(record.user),
    decidedBy: record.decidedBy ? toUserSummary(record.decidedBy) : null,
  };
};

/**
 * Query-side persistence. Joins only what the views need and pushes filtering, ordering,
 * counting and pagination down to PostgreSQL (backed by the composite indexes of the migration).
 */
export class TypeOrmVacationRequestReadModel implements VacationRequestReadModel {
  constructor(private readonly dataSource: DataSource) {}

  private requests(): SelectQueryBuilder<VacationRequestRecord> {
    return this.dataSource.getRepository(VacationRequestRecord).createQueryBuilder('request');
  }

  private withPeople(): SelectQueryBuilder<VacationRequestRecord> {
    return this.requests()
      .innerJoinAndSelect('request.user', 'user')
      .leftJoinAndSelect('request.decidedBy', 'decidedBy');
  }

  async findById(id: string): Promise<VacationRequestView | null> {
    const record = await this.withPeople().where('request.id = :id', { id }).getOne();
    return record ? toView(record) : null;
  }

  async list(criteria: VacationRequestListCriteria, page: PageRequest) {
    const query = this.withPeople();
    if (criteria.userId) query.andWhere('request.userId = :userId', { userId: criteria.userId });
    if (criteria.status) query.andWhere('request.status = :status', { status: criteria.status });

    const direction = criteria.order === 'asc' ? 'ASC' : 'DESC';
    query
      .orderBy(SORT_COLUMNS[criteria.sort], direction)
      // Deterministic ordering across pages when the sort key has ties.
      .addOrderBy('request.id', direction)
      .skip(toOffset(page))
      .take(page.pageSize);

    const [records, total] = await query.getManyAndCount();
    return { items: records.map(toView), total };
  }

  async countByStatus(userId?: string): Promise<StatusCounts> {
    const query = this.requests()
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

  async findBlockingInRange(from: IsoDate, to: IsoDate): Promise<CalendarEntryView[]> {
    const records = await this.requests()
      .where('request.status IN (:...statuses)', { statuses: BLOCKING_STATUSES })
      // Same range expression as the exclusion constraint (GiST-indexable).
      .andWhere(
        `daterange(request.startDate, request.endDate, '[]') && daterange(CAST(:from AS date), CAST(:to AS date), '[]')`,
        { from, to },
      )
      .orderBy('request.startDate', 'ASC')
      .getMany();
    return records.map(({ id, userId, startDate, endDate, status }) => ({
      id,
      userId,
      startDate,
      endDate,
      status,
    }));
  }
}
