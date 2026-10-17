import { Command, type CommandHandler } from '../../../../core/cqrs/command-bus';
import { VacationRequestErrors } from '../../domain/vacation-request.errors';
import { VacationRequestCancelledEvent } from '../events/vacation-request.events';
import type { VacationRequestCommandDependencies } from './dependencies';

/** Withdraws a pending or rejected request. Approved requests cannot be cancelled (rule #3). */
export class CancelVacationRequestCommand extends Command<void> {
  constructor(
    readonly actorId: string,
    readonly requestId: string,
  ) {
    super();
  }
}

export class CancelVacationRequestHandler implements CommandHandler<CancelVacationRequestCommand> {
  constructor(private readonly deps: VacationRequestCommandDependencies) {}

  async execute(command: CancelVacationRequestCommand): Promise<void> {
    const event = await this.deps.unitOfWork.run(async ({ vacationRequests }) => {
      const request = await vacationRequests.findById(command.requestId, { lock: true });
      if (!request) throw VacationRequestErrors.notFound();
      if (!request.isOwnedBy(command.actorId)) throw VacationRequestErrors.notOwner();
      request.assertModifiable();

      // Snapshot before deletion: TypeORM clears the id of removed entities.
      const cancelled = VacationRequestCancelledEvent.from(request);
      await vacationRequests.remove(request);
      return cancelled;
    });

    await this.deps.events.publish(event);
  }
}
