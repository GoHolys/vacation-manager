import { Brackets, type EntityManager, type Repository } from 'typeorm';
import { isPgError, PgErrorCode } from '../../../infrastructure/database/postgres-errors';
import type { VacationRequestRepository } from '../application/ports';
import type { VacationPeriod } from '../domain/vacation-period';
import type { VacationRequest } from '../domain/vacation-request';
import { VacationRequestErrors } from '../domain/vacation-request.errors';
import { BLOCKING_STATUSES } from '../domain/vacation-request-status';
import { toVacationRequest, VacationRequestRecord } from './vacation-request.record';

const OVERLAP_CONSTRAINT = 'ex_vacation_requests_no_overlap';

/**
 * Write-side repository: loads `VacationRequest` aggregates and persists their state.
 * Writes use explicit, parameterised SQL so the aggregate's own values (id, timestamps) are
 * stored exactly as the domain produced them.
 */
export class TypeOrmVacationRequestRepository implements VacationRequestRepository {
  private readonly repository: Repository<VacationRequestRecord>;

  constructor(private readonly manager: EntityManager) {
    this.repository = manager.getRepository(VacationRequestRecord);
  }

  async findById(id: string, options: { lock?: boolean } = {}): Promise<VacationRequest | null> {
    const query = this.repository.createQueryBuilder('request').where('request.id = :id', { id });
    if (options.lock) query.setLock('pessimistic_write');
    const record = await query.getOne();
    return record ? toVacationRequest(record) : null;
  }

  async findOverlapping(
    userId: string,
    period: VacationPeriod,
    excludeRequestId?: string,
  ): Promise<VacationRequest[]> {
    const query = this.repository
      .createQueryBuilder('request')
      .where('request.userId = :userId', { userId })
      .andWhere('request.status IN (:...statuses)', { statuses: BLOCKING_STATUSES })
      // Inclusive ranges overlap when each starts before the other ends.
      .andWhere(
        new Brackets((where) =>
          where
            .where('request.startDate <= :endDate', { endDate: period.endDate })
            .andWhere('request.endDate >= :startDate', { startDate: period.startDate }),
        ),
      )
      .orderBy('request.startDate', 'ASC');
    if (excludeRequestId) query.andWhere('request.id <> :excludeRequestId', { excludeRequestId });
    return (await query.getMany()).map(toVacationRequest);
  }

  async add(request: VacationRequest): Promise<void> {
    const s = request.snapshot();
    await this.write(
      `INSERT INTO "vacation_requests"
         ("id", "user_id", "start_date", "end_date", "reason", "status", "comments",
          "decided_by", "decided_at", "created_at", "updated_at")
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11)`,
      [
        s.id,
        s.userId,
        s.startDate,
        s.endDate,
        s.reason,
        s.status,
        s.comments,
        s.decidedById,
        s.decidedAt,
        s.createdAt,
        s.updatedAt,
      ],
    );
  }

  async save(request: VacationRequest): Promise<void> {
    const s = request.snapshot();
    await this.write(
      `UPDATE "vacation_requests"
          SET "start_date" = $2, "end_date" = $3, "reason" = $4, "status" = $5, "comments" = $6,
              "decided_by" = $7, "decided_at" = $8, "updated_at" = $9
        WHERE "id" = $1`,
      [
        s.id,
        s.startDate,
        s.endDate,
        s.reason,
        s.status,
        s.comments,
        s.decidedById,
        s.decidedAt,
        s.updatedAt,
      ],
    );
  }

  async remove(request: VacationRequest): Promise<void> {
    await this.repository.delete({ id: request.id });
  }

  private async write(sql: string, parameters: unknown[]): Promise<void> {
    try {
      await this.manager.query(sql, parameters);
    } catch (error) {
      // Lost a race against a concurrent request for overlapping dates: the exclusion
      // constraint rejected the write. Surface it as the same domain error.
      if (isPgError(error, PgErrorCode.EXCLUSION_VIOLATION, OVERLAP_CONSTRAINT)) {
        throw VacationRequestErrors.overlap([]);
      }
      throw error;
    }
  }
}
