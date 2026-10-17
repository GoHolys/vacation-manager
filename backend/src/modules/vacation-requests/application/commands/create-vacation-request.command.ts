import { Command, type CommandHandler } from '../../../../core/cqrs/command-bus';
import { UnauthorizedError } from '../../../../core/errors';
import { UserRole } from '../../../users/domain/user-role';
import { VacationPeriod } from '../../domain/vacation-period';
import { VacationRequest } from '../../domain/vacation-request.entity';
import { VacationRequestErrors } from '../../domain/vacation-request.errors';
import { VacationRequestSubmittedEvent } from '../events/vacation-request.events';
import { assertNoOverlap } from '../policies/overlap.policy';
import type { VacationRequestCommandDependencies } from './dependencies';

export class CreateVacationRequestCommand extends Command<{ id: string }> {
  constructor(
    readonly requesterId: string,
    readonly startDate: string,
    readonly endDate: string,
    readonly reason?: string | null,
  ) {
    super();
  }
}

export class CreateVacationRequestHandler implements CommandHandler<CreateVacationRequestCommand> {
  constructor(private readonly deps: VacationRequestCommandDependencies) {}

  async execute(command: CreateVacationRequestCommand): Promise<{ id: string }> {
    const request = await this.deps.unitOfWork.run(async ({ users, vacationRequests }) => {
      const requester = await users.findById(command.requesterId);
      if (!requester) throw new UnauthorizedError('Your account no longer exists');
      if (!requester.hasRole(UserRole.REQUESTER)) throw VacationRequestErrors.onlyRequestersCanSubmit();

      const period = VacationPeriod.create(command.startDate, command.endDate, this.deps.clock.today());
      await assertNoOverlap(vacationRequests, requester.id, period);

      return vacationRequests.save(
        VacationRequest.submit({ userId: requester.id, period, reason: command.reason }),
      );
    });

    await this.deps.events.publish(VacationRequestSubmittedEvent.from(request));
    return { id: request.id };
  }
}
