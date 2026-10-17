import type { Clock } from '../../../../core/clock';
import type { EventPublisher } from '../../../../core/cqrs/event-bus';
import type { UnitOfWork } from '../../../../core/unit-of-work';
import type { VacationRequestsScope } from '../ports';

/** Collaborators shared by every vacation-request command handler. */
export interface VacationRequestCommandDependencies {
  unitOfWork: UnitOfWork<VacationRequestsScope>;
  events: EventPublisher;
  clock: Clock;
}
