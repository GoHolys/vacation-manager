import type { DataSource } from 'typeorm';
import { type AppConfig, getConfig } from '../config/env';
import { type Clock, SystemClock } from '../core/clock';
import { CommandBus, commandLoggingMiddleware } from '../core/cqrs/command-bus';
import { InProcessEventBus } from '../core/cqrs/event-bus';
import { QueryBus } from '../core/cqrs/query-bus';
import { createLogger, type Logger } from '../core/logger';
import type { Notifier } from '../core/notifier';
import { createDataSource } from '../infrastructure/database/data-source';
import { TypeOrmUnitOfWork } from '../infrastructure/database/typeorm-unit-of-work';
import { LogNotifier } from '../infrastructure/notifications/log-notifier';
import { AuditTrailSubscriber } from '../modules/audit/audit-trail.subscriber';
import { Authenticator } from '../modules/auth/application/authenticator';
import {
  AuthenticateUserCommand,
  AuthenticateUserHandler,
} from '../modules/auth/application/commands/authenticate-user.command';
import { BcryptPasswordHasher } from '../modules/auth/infrastructure/bcrypt-password-hasher';
import { InMemoryLoginAttemptLimiter } from '../modules/auth/infrastructure/in-memory-login-attempt-limiter';
import { JwtTokenService } from '../modules/auth/infrastructure/jwt-token.service';
import { GetUserHandler, GetUserQuery } from '../modules/users/application/queries/get-user.query';
import { ListUsersHandler, ListUsersQuery } from '../modules/users/application/queries/list-users.query';
import { TypeOrmUserRepository } from '../modules/users/infrastructure/typeorm-user.repository';
import {
  ApproveVacationRequestCommand,
  ApproveVacationRequestHandler,
} from '../modules/vacation-requests/application/commands/approve-vacation-request.command';
import {
  CancelVacationRequestCommand,
  CancelVacationRequestHandler,
} from '../modules/vacation-requests/application/commands/cancel-vacation-request.command';
import {
  CreateVacationRequestCommand,
  CreateVacationRequestHandler,
} from '../modules/vacation-requests/application/commands/create-vacation-request.command';
import type { VacationRequestCommandDependencies } from '../modules/vacation-requests/application/commands/dependencies';
import {
  RejectVacationRequestCommand,
  RejectVacationRequestHandler,
} from '../modules/vacation-requests/application/commands/reject-vacation-request.command';
import {
  UpdateVacationRequestCommand,
  UpdateVacationRequestHandler,
} from '../modules/vacation-requests/application/commands/update-vacation-request.command';
import {
  VacationRequestApprovedEvent,
  VacationRequestRejectedEvent,
  VacationRequestSubmittedEvent,
  VacationRequestUpdatedEvent,
} from '../modules/vacation-requests/application/events/vacation-request.events';
import {
  GetTeamCalendarHandler,
  GetTeamCalendarQuery,
} from '../modules/vacation-requests/application/queries/get-team-calendar.query';
import {
  GetVacationRequestHandler,
  GetVacationRequestQuery,
} from '../modules/vacation-requests/application/queries/get-vacation-request.query';
import {
  GetVacationRequestStatsHandler,
  GetVacationRequestStatsQuery,
} from '../modules/vacation-requests/application/queries/get-vacation-request-stats.query';
import {
  ListVacationRequestsHandler,
  ListVacationRequestsQuery,
} from '../modules/vacation-requests/application/queries/list-vacation-requests.query';
import {
  NotifyRequesterOfDecision,
  NotifyValidatorsOfPendingRequest,
} from '../modules/vacation-requests/application/subscribers/notification.subscribers';
import { TypeOrmVacationRequestReadModel } from '../modules/vacation-requests/infrastructure/typeorm-vacation-request.read-model';

export interface Application {
  config: AppConfig;
  logger: Logger;
  dataSource: DataSource;
  commandBus: CommandBus;
  queryBus: QueryBus;
  eventBus: InProcessEventBus;
  authenticator: Authenticator;
  shutdown(): Promise<void>;
}

export interface ApplicationOverrides {
  clock?: Clock;
  logger?: Logger;
  notifier?: Notifier;
}

/**
 * Composition root — the only place that knows about concrete implementations.
 * Everything else depends on ports (interfaces), which keeps modules decoupled and testable.
 */
export async function createApplication(
  config: AppConfig,
  overrides: ApplicationOverrides = {},
): Promise<Application> {
  const logger =
    overrides.logger ?? createLogger({ level: config.logLevel, pretty: config.env === 'development' });
  const clock = overrides.clock ?? new SystemClock(config.timeZone);

  const dataSource = createDataSource(config.database);
  await dataSource.initialize();

  // ─── Infrastructure ────────────────────────────────────────────────────────
  const users = new TypeOrmUserRepository(dataSource.manager);
  const vacationRequestReadModel = new TypeOrmVacationRequestReadModel(dataSource);
  const notifier = overrides.notifier ?? new LogNotifier(logger);
  const tokens = new JwtTokenService({
    secret: config.auth.jwtSecret,
    expiresIn: config.auth.jwtExpiresIn,
    issuer: config.auth.jwtIssuer,
    audience: config.auth.jwtAudience,
  });
  const loginLimiter = new InMemoryLoginAttemptLimiter(
    config.auth.loginMaxAttempts,
    config.auth.loginLockoutMinutes * 60_000,
    clock,
  );

  // ─── Events ────────────────────────────────────────────────────────────────
  const eventBus = new InProcessEventBus(logger);
  const notifyValidators = new NotifyValidatorsOfPendingRequest(users, notifier);
  const notifyRequester = new NotifyRequesterOfDecision(users, notifier);
  eventBus
    .subscribeAll(new AuditTrailSubscriber(dataSource))
    .subscribe(VacationRequestSubmittedEvent, notifyValidators)
    .subscribe(VacationRequestUpdatedEvent, notifyValidators)
    .subscribe(VacationRequestApprovedEvent, notifyRequester)
    .subscribe(VacationRequestRejectedEvent, notifyRequester);

  // ─── Commands ──────────────────────────────────────────────────────────────
  const commandDeps: VacationRequestCommandDependencies = {
    unitOfWork: new TypeOrmUnitOfWork(dataSource),
    events: eventBus,
    clock,
  };
  const commandBus = new CommandBus()
    .use(commandLoggingMiddleware(logger))
    .register(
      AuthenticateUserCommand,
      new AuthenticateUserHandler(
        users,
        new BcryptPasswordHasher(config.auth.bcryptRounds),
        tokens,
        loginLimiter,
      ),
    )
    .register(CreateVacationRequestCommand, new CreateVacationRequestHandler(commandDeps))
    .register(UpdateVacationRequestCommand, new UpdateVacationRequestHandler(commandDeps))
    .register(CancelVacationRequestCommand, new CancelVacationRequestHandler(commandDeps))
    .register(ApproveVacationRequestCommand, new ApproveVacationRequestHandler(commandDeps))
    .register(RejectVacationRequestCommand, new RejectVacationRequestHandler(commandDeps));

  // ─── Queries ───────────────────────────────────────────────────────────────
  const queryBus = new QueryBus()
    .register(GetUserQuery, new GetUserHandler(users))
    .register(ListUsersQuery, new ListUsersHandler(users))
    .register(ListVacationRequestsQuery, new ListVacationRequestsHandler(vacationRequestReadModel))
    .register(GetVacationRequestQuery, new GetVacationRequestHandler(vacationRequestReadModel))
    .register(
      GetVacationRequestStatsQuery,
      new GetVacationRequestStatsHandler(vacationRequestReadModel),
    )
    .register(GetTeamCalendarQuery, new GetTeamCalendarHandler(vacationRequestReadModel, users));

  logger.info({ env: config.env, database: config.database.database }, 'application initialised');

  return {
    config,
    logger,
    dataSource,
    commandBus,
    queryBus,
    eventBus,
    authenticator: new Authenticator(tokens, users),
    async shutdown() {
      if (dataSource.isInitialized) await dataSource.destroy();
      logger.info('application shut down');
    },
  };
}

let applicationPromise: Promise<Application> | undefined;

/**
 * Lazily creates the process-wide application. Lazy initialisation keeps Lambda cold starts
 * cheap and lets `.env` be loaded (by the Common Event Framework) before config is read.
 */
export function getApplication(): Promise<Application> {
  applicationPromise ??= createApplication(getConfig()).catch((error: unknown) => {
    applicationPromise = undefined; // allow a retry on the next request
    throw error;
  });
  return applicationPromise;
}

/** Replaces the process-wide application (used by the e2e test-suite). */
export function setApplication(application: Application | undefined): void {
  applicationPromise = application ? Promise.resolve(application) : undefined;
}
