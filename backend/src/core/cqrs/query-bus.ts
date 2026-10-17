import type { MessageType } from './command-bus';

/**
 * A query reads state and never mutates it. Queries are dispatched through their own bus so
 * read and write paths can evolve (and later scale) independently — a lightweight CQRS split.
 */
export abstract class Query<TResult> {
  declare readonly __resultType?: TResult;
}

export type QueryResult<Q> = Q extends Query<infer R> ? R : never;

export interface QueryHandler<Q extends Query<unknown>> {
  execute(query: Q): Promise<QueryResult<Q>>;
}

export class QueryBus {
  private readonly handlers = new Map<MessageType<Query<unknown>>, QueryHandler<never>>();

  register<Q extends Query<unknown>>(type: MessageType<Q>, handler: QueryHandler<Q>): this {
    if (this.handlers.has(type)) {
      throw new Error(`A handler is already registered for query ${type.name}`);
    }
    this.handlers.set(type, handler as unknown as QueryHandler<never>);
    return this;
  }

  async execute<Q extends Query<unknown>>(query: Q): Promise<QueryResult<Q>> {
    const type = query.constructor as MessageType<Q>;
    const handler = this.handlers.get(type) as QueryHandler<Q> | undefined;
    if (!handler) {
      throw new Error(`No handler registered for query ${type.name}`);
    }
    return handler.execute(query);
  }
}
