import { randomUUID } from 'node:crypto';

/**
 * A domain event states a fact that already happened (VacationRequestApproved…).
 *
 * It lives in the shared kernel, free of any framework or bus dependency, so aggregates can
 * record events while they change state. Events are immutable, carry a unique id (used for
 * idempotent processing, e.g. by the audit trail) and a timestamp, and are published only
 * *after* the transaction that produced them has committed.
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

/** Implemented by aggregates that record domain events while they change state. */
export interface EventRecorder {
  /** Returns the events recorded since the last call and clears them. */
  pullEvents(): DomainEvent[];
}
