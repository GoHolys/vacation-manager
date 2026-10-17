import { Brackets, type EntityManager, type Repository } from 'typeorm';
import { isPgError, PgErrorCode } from '../../../infrastructure/database/postgres-errors';
import type { VacationRequestRepository } from '../application/ports';
import type { VacationPeriod } from '../domain/vacation-period';
import { VacationRequest } from '../domain/vacation-request.entity';
import { VacationRequestErrors } from '../domain/vacation-request.errors';
import { BLOCKING_STATUSES } from '../domain/vacation-request-status';

const OVERLAP_CONSTRAINT = 'ex_vacation_requests_no_overlap';

export class TypeOrmVacationRequestRepository implements VacationRequestRepository {
  private readonly repository: Repository<VacationRequest>;

  constructor(manager: EntityManager) {
    this.repository = manager.getRepository(VacationRequest);
  }

  findById(id: string, options: { lock?: boolean } = {}): Promise<VacationRequest | null> {
    const query = this.repository.createQueryBuilder('request').where('request.id = :id', { id });
    if (options.lock) query.setLock('pessimistic_write');
    return query.getOne();
  }

  findOverlapping(
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
    return query.getMany();
  }

  async save(request: VacationRequest): Promise<VacationRequest> {
    try {
      return await this.repository.save(request);
    } catch (error) {
      // Lost a race against a concurrent request for overlapping dates: the exclusion
      // constraint rejected the write. Surface it as the same domain error.
      if (isPgError(error, PgErrorCode.EXCLUSION_VIOLATION, OVERLAP_CONSTRAINT)) {
        throw VacationRequestErrors.overlap([]);
      }
      throw error;
    }
  }

  async remove(request: VacationRequest): Promise<void> {
    await this.repository.delete({ id: request.id });
  }
}
