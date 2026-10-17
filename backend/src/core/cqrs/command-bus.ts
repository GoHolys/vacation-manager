import type { Logger } from '../logger';

/**
 * A command expresses the *intent* to change state (CreateVacationRequest, ApproveVacationRequest…).
 * The generic parameter is a phantom type carrying the handler's result type so that
 * `commandBus.execute(cmd)` is fully type-inferred at the call-site.
 */
export abstract class Command<TResult = void> {
  declare readonly __resultType?: TResult;
}

export type CommandResult<C> = C extends Command<infer R> ? R : never;

export interface CommandHandler<C extends Command<unknown>> {
  execute(command: C): Promise<CommandResult<C>>;
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
export type MessageType<T> = abstract new (...args: any[]) => T;

/** Cross-cutting behaviour wrapped around every command (logging, metrics, tracing…). */
export type CommandMiddleware = (
  command: Command<unknown>,
  next: () => Promise<unknown>,
) => Promise<unknown>;

export class CommandBus {
  private readonly handlers = new Map<MessageType<Command<unknown>>, CommandHandler<never>>();
  private readonly middlewares: CommandMiddleware[] = [];

  register<C extends Command<unknown>>(type: MessageType<C>, handler: CommandHandler<C>): this {
    if (this.handlers.has(type)) {
      throw new Error(`A handler is already registered for command ${type.name}`);
    }
    this.handlers.set(type, handler as unknown as CommandHandler<never>);
    return this;
  }

  use(middleware: CommandMiddleware): this {
    this.middlewares.push(middleware);
    return this;
  }

  async execute<C extends Command<unknown>>(command: C): Promise<CommandResult<C>> {
    const type = command.constructor as MessageType<C>;
    const handler = this.handlers.get(type) as CommandHandler<C> | undefined;
    if (!handler) {
      throw new Error(`No handler registered for command ${type.name}`);
    }

    const dispatch = this.middlewares.reduceRight<() => Promise<unknown>>(
      (next, middleware) => () => middleware(command, next),
      () => handler.execute(command),
    );
    return (await dispatch()) as CommandResult<C>;
  }
}

export const commandLoggingMiddleware =
  (logger: Logger): CommandMiddleware =>
  async (command, next) => {
    const name = command.constructor.name;
    const startedAt = performance.now();
    try {
      const result = await next();
      logger.debug(
        { command: name, durationMs: Math.round(performance.now() - startedAt) },
        'command executed',
      );
      return result;
    } catch (error) {
      logger.debug(
        {
          command: name,
          durationMs: Math.round(performance.now() - startedAt),
          error: (error as Error).message,
        },
        'command failed',
      );
      throw error;
    }
  };
