import { Column, Entity, Index, PrimaryGeneratedColumn, Unique } from 'typeorm';

/**
 * Append-only audit trail, populated by an event subscriber from published domain events.
 * Gives a full history of every request (who submitted, edited, approved or rejected it and when)
 * without coupling that concern to the command handlers.
 */
@Entity({ name: 'audit_logs' })
@Unique('uq_audit_logs_event_id', ['eventId'])
@Index('idx_audit_logs_aggregate', ['aggregateId', 'occurredAt'])
export class AuditLog {
  @PrimaryGeneratedColumn('uuid', { primaryKeyConstraintName: 'pk_audit_logs' })
  id!: string;

  @Column({ name: 'event_id', type: 'uuid' })
  eventId!: string;

  @Column({ name: 'event_name', type: 'varchar', length: 100 })
  eventName!: string;

  @Column({ name: 'aggregate_id', type: 'uuid' })
  aggregateId!: string;

  @Column({ name: 'actor_id', type: 'uuid', nullable: true })
  actorId!: string | null;

  @Column({ type: 'jsonb' })
  payload!: Record<string, unknown>;

  @Column({ name: 'occurred_at', type: 'timestamptz' })
  occurredAt!: Date;
}
