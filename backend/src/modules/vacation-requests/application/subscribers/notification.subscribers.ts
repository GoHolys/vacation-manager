import type { EventHandler } from '../../../../core/cqrs/event-bus';
import type { Notifier } from '../../../../core/notifier';
import type { UserRepository } from '../../../users/application/user.repository';
import { UserRole } from '../../../users/domain/user-role';
import type {
  VacationRequestApprovedEvent,
  VacationRequestRejectedEvent,
  VacationRequestSubmittedEvent,
  VacationRequestUpdatedEvent,
} from '../events/vacation-request.events';

const formatPeriod = (start: string, end: string) => `${start} → ${end}`;

/** Tells the requester that a validator approved or rejected their request. */
export class NotifyRequesterOfDecision implements EventHandler<
  VacationRequestApprovedEvent | VacationRequestRejectedEvent
> {
  readonly name = 'NotifyRequesterOfDecision';

  constructor(
    private readonly users: UserRepository,
    private readonly notifier: Notifier,
  ) {}

  async handle(event: VacationRequestApprovedEvent | VacationRequestRejectedEvent): Promise<void> {
    const { userId, startDate, endDate, status, comment } = event.payload;
    const requester = await this.users.findById(userId);
    if (!requester) return;

    await this.notifier.send({
      to: { name: requester.name, email: requester.email },
      subject: `Your vacation request was ${status}`,
      body:
        `Hi ${requester.name}, your vacation request for ${formatPeriod(startDate, endDate)} ` +
        `was ${status}.${comment ? ` Comment: "${comment}"` : ''}`,
    });
  }
}

/** Tells every validator that a request is waiting for review. */
export class NotifyValidatorsOfPendingRequest implements EventHandler<
  VacationRequestSubmittedEvent | VacationRequestUpdatedEvent
> {
  readonly name = 'NotifyValidatorsOfPendingRequest';

  constructor(
    private readonly users: UserRepository,
    private readonly notifier: Notifier,
  ) {}

  async handle(event: VacationRequestSubmittedEvent | VacationRequestUpdatedEvent): Promise<void> {
    const { userId, startDate, endDate } = event.payload;
    const isResubmission = 'resubmitted' in event.payload && event.payload.resubmitted;
    const isNewSubmission = event.eventName === 'vacation-request.submitted';
    if (!isNewSubmission && !isResubmission) return;

    const [requester, validators] = await Promise.all([
      this.users.findById(userId),
      this.users.list({ role: UserRole.VALIDATOR }),
    ]);
    const who = requester?.name ?? 'A team member';

    await Promise.all(
      validators.map((validator) =>
        this.notifier.send({
          to: { name: validator.name, email: validator.email },
          subject: 'A vacation request is awaiting your review',
          body: `${who} ${isResubmission ? 're-submitted' : 'submitted'} a request for ${formatPeriod(startDate, endDate)}.`,
        }),
      ),
    );
  }
}
