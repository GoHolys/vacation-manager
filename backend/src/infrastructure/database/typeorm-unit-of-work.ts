import type { DataSource } from 'typeorm';
import type { UnitOfWork } from '../../core/unit-of-work';
import type { VacationRequestsScope } from '../../modules/vacation-requests/application/ports';
import { TypeOrmUserRepository } from '../../modules/users/infrastructure/typeorm-user.repository';
import { TypeOrmVacationRequestRepository } from '../../modules/vacation-requests/infrastructure/typeorm-vacation-request.repository';

/** Executes work inside a single `READ COMMITTED` transaction with transaction-bound repositories. */
export class TypeOrmUnitOfWork implements UnitOfWork<VacationRequestsScope> {
  constructor(private readonly dataSource: DataSource) {}

  run<T>(work: (scope: VacationRequestsScope) => Promise<T>): Promise<T> {
    return this.dataSource.transaction('READ COMMITTED', (manager) =>
      work({
        vacationRequests: new TypeOrmVacationRequestRepository(manager),
        users: new TypeOrmUserRepository(manager),
      }),
    );
  }
}
