import { randomUUID } from 'node:crypto';
import type { Logger } from '../logger';
import type { MessageType } from './command-bus';

/**
 * A domain event states a fact that already happened (VacationRequestApproved…).
 * Events are immutable, carry a unique id + timestamp, and are published only *after*
 * the transaction that produced them has committed.
 */
export abstract class DomainEvent<TPayload extends object = object> {
  abstract readonly eventName: string;
  readonly eventId: string = randomUUID();
  readonly occurredAt: Date = new Date();

  constructor(
    readonly aggregateId: string,
    readonly payload: Readonly<TPayload>,
  ) {}
}

export interface EventHandler<E extends DomainEvent> {
  /** Human-readable name used in logs when the handler fails. */
  readonly name: string;
  handle(event: E): Promise<void>;
}

export interface EventPublisher {
  publish(...events: DomainEvent[]): Promise<void>;
}

/**
 * In-process event bus.
 *
 * Subscribers are isolated from each other and from the command that raised the event:
 * a failing subscriber is logged but never rolls back already-committed state nor
 * breaks the HTTP response. Swapping this class for an SQS/SNS/Kafka-backed publisher
 * (the Common Event Framework already normalises SQS events into routes) requires no
 * change in command handlers — they only depend on `EventPublisher`.
 */
export class InProcessEventBus implements EventPublisher {
  private readonly subscribers = new Map<MessageType<DomainEvent>, EventHandler<never>[]>();
  private readonly wildcardSubscribers: EventHandler<DomainEvent>[] = [];

  constructor(private readonly logger: Logger) {}

  subscribe<E extends DomainEvent>(type: MessageType<E>, handler: EventHandler<E>): this {
    const handlers = this.subscribers.get(type) ?? [];
    handlers.push(handler as unknown as EventHandler<never>);
    this.subscribers.set(type, handlers);
    return this;
  }

  /** Receives every event (audit trail, outbox, metrics…). */
  subscribeAll(handler: EventHandler<DomainEvent>): this {
    this.wildcardSubscribers.push(handler);
    return this;
  }

  async publish(...events: DomainEvent[]): Promise<void> {
    for (const event of events) {
      const handlers = [
        ...((this.subscribers.get(event.constructor as MessageType<DomainEvent>) ??
          []) as EventHandler<DomainEvent>[]),
        ...this.wildcardSubscribers,
      ];
      this.logger.info(
        { event: event.eventName, eventId: event.eventId, aggregateId: event.aggregateId },
        'domain event published',
      );

      const results = await Promise.allSettled(handlers.map((handler) => handler.handle(event)));
      results.forEach((result, index) => {
        if (result.status === 'rejected') {
          this.logger.error(
            { err: result.reason, event: event.eventName, handler: handlers[index]?.name },
            'event handler failed',
          );
        }
      });
    }
  }
}
