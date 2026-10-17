import type { DataSource } from 'typeorm';
import type { DomainEvent, EventHandler } from '../../core/cqrs/event-bus';

/** Persists every published domain event to the `audit_logs` table (idempotent on event id). */
export class AuditTrailSubscriber implements EventHandler<DomainEvent> {
  readonly name = 'AuditTrailSubscriber';

  constructor(private readonly dataSource: DataSource) {}

  async handle(event: DomainEvent): Promise<void> {
    const payload = event.payload as Record<string, unknown>;
    // Plain parameterised SQL: idempotent thanks to the unique constraint on event_id.
    await this.dataSource.query(
      `INSERT INTO "audit_logs" ("event_id", "event_name", "aggregate_id", "actor_id", "payload", "occurred_at")
       VALUES ($1, $2, $3, $4, $5::jsonb, $6)
       ON CONFLICT ON CONSTRAINT "uq_audit_logs_event_id" DO NOTHING`,
      [
        event.eventId,
        event.eventName,
        event.aggregateId,
        typeof payload.actorId === 'string' ? payload.actorId : null,
        JSON.stringify(payload),
        event.occurredAt,
      ],
    );
  }
}
