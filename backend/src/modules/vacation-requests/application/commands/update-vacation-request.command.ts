import { Command, type CommandHandler } from '../../../../core/cqrs/command-bus';
import { VacationPeriod } from '../../domain/vacation-period';
import { VacationRequestErrors } from '../../domain/vacation-request.errors';
import { VacationRequestUpdatedEvent } from '../events/vacation-request.events';
import { assertNoOverlap } from '../policies/overlap.policy';
import type { VacationRequestCommandDependencies } from './dependencies';

/**
 * Lets a requester change the dates/reason of one of their requests.
 * Pending requests stay pending; rejected requests are re-submitted for review;
 * approved requests are immutable (business rule #3).
 */
export class UpdateVacationRequestCommand extends Command<{ id: string; resubmitted: boolean }> {
  constructor(
    readonly actorId: string,
    readonly requestId: string,
    readonly startDate: string,
    readonly endDate: string,
    readonly reason?: string | null,
  ) {
    super();
  }
}

export class UpdateVacationRequestHandler implements CommandHandler<UpdateVacationRequestCommand> {
  constructor(private readonly deps: VacationRequestCommandDependencies) {}

  async execute(command: UpdateVacationRequestCommand) {
    const { request, resubmitted } = await this.deps.unitOfWork.run(async ({ vacationRequests }) => {
      const request = await vacationRequests.findById(command.requestId, { lock: true });
      if (!request) throw VacationRequestErrors.notFound();
      if (!request.isOwnedBy(command.actorId)) throw VacationRequestErrors.notOwner();
      request.assertModifiable();

      const period = VacationPeriod.create(command.startDate, command.endDate, this.deps.clock.today());
      await assertNoOverlap(vacationRequests, request.userId, period, request.id);

      const { resubmitted } = request.reschedule(period, command.reason);
      return { request: await vacationRequests.save(request), resubmitted };
    });

    await this.deps.events.publish(VacationRequestUpdatedEvent.from(request, resubmitted));
    return { id: request.id, resubmitted };
  }
}
