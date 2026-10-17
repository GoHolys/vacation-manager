import { Command, type CommandHandler } from '../../../../core/cqrs/command-bus';
import { UserRole } from '../../../users/domain/user-role';
import { VacationRequestErrors } from '../../domain/vacation-request.errors';
import type { VacationRequestsScope } from '../ports';
import type { VacationRequestCommandDependencies } from './dependencies';

export class ApproveVacationRequestCommand extends Command<void> {
  constructor(
    readonly validatorId: string,
    readonly requestId: string,
    readonly comment?: string | null,
  ) {
    super();
  }
}

/**
 * Rule #6 — only validators can decide. Enforced here (defence in depth) in addition to the
 * route-level RBAC declared in root.yaml, so the rule holds whatever the entry point.
 */
export async function assertIsValidator(
  users: VacationRequestsScope['users'],
  userId: string,
): Promise<void> {
  const actor = await users.findById(userId);
  if (!actor?.hasRole(UserRole.VALIDATOR)) throw VacationRequestErrors.onlyValidatorsCanDecide();
}

export class ApproveVacationRequestHandler implements CommandHandler<ApproveVacationRequestCommand> {
  constructor(private readonly deps: VacationRequestCommandDependencies) {}

  async execute(command: ApproveVacationRequestCommand): Promise<void> {
    const request = await this.deps.unitOfWork.run(async ({ users, vacationRequests }) => {
      await assertIsValidator(users, command.validatorId);

      // Row lock: two validators acting at the same time cannot both decide the request.
      const request = await vacationRequests.findById(command.requestId, { lock: true });
      if (!request) throw VacationRequestErrors.notFound();

      // The aggregate records VacationRequestApprovedEvent.
      request.approve(command.validatorId, command.comment, this.deps.clock.now());
      await vacationRequests.save(request);
      return request;
    });

    await this.deps.events.publish(...request.pullEvents());
  }
}
