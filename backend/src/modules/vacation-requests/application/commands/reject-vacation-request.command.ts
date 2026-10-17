import { Command, type CommandHandler } from '../../../../core/cqrs/command-bus';
import { VacationRequestErrors } from '../../domain/vacation-request.errors';
import { VacationRequestRejectedEvent } from '../events/vacation-request.events';
import { assertIsValidator } from './approve-vacation-request.command';
import type { VacationRequestCommandDependencies } from './dependencies';

export class RejectVacationRequestCommand extends Command<void> {
  constructor(
    readonly validatorId: string,
    readonly requestId: string,
    readonly comment: string,
  ) {
    super();
  }
}

export class RejectVacationRequestHandler implements CommandHandler<RejectVacationRequestCommand> {
  constructor(private readonly deps: VacationRequestCommandDependencies) {}

  async execute(command: RejectVacationRequestCommand): Promise<void> {
    const request = await this.deps.unitOfWork.run(async ({ users, vacationRequests }) => {
      await assertIsValidator(users, command.validatorId);

      const request = await vacationRequests.findById(command.requestId, { lock: true });
      if (!request) throw VacationRequestErrors.notFound();

      // Rule #5 is enforced by the aggregate (and by a CHECK constraint in the database).
      request.reject(command.validatorId, command.comment, this.deps.clock.now());
      return vacationRequests.save(request);
    });

    await this.deps.events.publish(VacationRequestRejectedEvent.from(request, command.validatorId));
  }
}
