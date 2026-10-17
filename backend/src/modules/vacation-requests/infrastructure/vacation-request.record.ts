import {
  Check,
  Column,
  CreateDateColumn,
  Entity,
  Exclusion,
  Index,
  JoinColumn,
  ManyToOne,
  PrimaryGeneratedColumn,
  UpdateDateColumn,
} from 'typeorm';
import type { IsoDate } from '../../../core/iso-date';
import { UserRecord } from '../../users/infrastructure/user.record';
import { REASON_MAX_LENGTH, VacationRequest } from '../domain/vacation-request';
import {
  VACATION_REQUEST_STATUSES,
  VacationRequestStatus,
} from '../domain/vacation-request-status';

/**
 * Persistence model of the `vacation_requests` table — TypeORM mapping only, no behaviour.
 *
 * The domain works with the pure `VacationRequest` aggregate; repositories translate between the
 * two. The most critical invariants are *also* declared here as database constraints (CHECK +
 * EXCLUDE), the last line of defence against races and manual data changes.
 */
@Entity({ name: 'vacation_requests' })
@Check('chk_vacation_requests_dates', `"end_date" > "start_date"`)
@Check(
  'chk_vacation_requests_rejection_comment',
  `"status" <> 'rejected' OR ("comments" IS NOT NULL AND length(btrim("comments")) > 0)`,
)
@Exclusion(
  'ex_vacation_requests_no_overlap',
  `USING gist ("user_id" WITH =, daterange("start_date", "end_date", '[]') WITH &&) WHERE ("status" <> 'rejected')`,
)
@Index('idx_vacation_requests_user_start', ['userId', 'startDate'])
@Index('idx_vacation_requests_status_created', ['status', 'createdAt'])
@Index('idx_vacation_requests_created', ['createdAt'])
export class VacationRequestRecord {
  @PrimaryGeneratedColumn('uuid', { primaryKeyConstraintName: 'pk_vacation_requests' })
  id!: string;

  @Column({ name: 'user_id', type: 'uuid' })
  userId!: string;

  @ManyToOne(() => UserRecord, { nullable: false, onDelete: 'CASCADE' })
  @JoinColumn({ name: 'user_id', foreignKeyConstraintName: 'fk_vacation_requests_user' })
  user?: UserRecord;

  @Column({ name: 'start_date', type: 'date' })
  startDate!: IsoDate;

  @Column({ name: 'end_date', type: 'date' })
  endDate!: IsoDate;

  @Column({ type: 'varchar', length: REASON_MAX_LENGTH, nullable: true })
  reason!: string | null;

  @Column({
    type: 'enum',
    enum: VACATION_REQUEST_STATUSES,
    enumName: 'vacation_request_status',
    default: VacationRequestStatus.PENDING,
  })
  status!: VacationRequestStatus;

  /** Validator's comment — mandatory when rejected, optional when approved. */
  @Column({ type: 'text', nullable: true })
  comments!: string | null;

  @Column({ name: 'decided_by', type: 'uuid', nullable: true })
  decidedById!: string | null;

  @ManyToOne(() => UserRecord, { nullable: true, onDelete: 'SET NULL' })
  @JoinColumn({ name: 'decided_by', foreignKeyConstraintName: 'fk_vacation_requests_decided_by' })
  decidedBy?: UserRecord | null;

  @Column({ name: 'decided_at', type: 'timestamptz', nullable: true })
  decidedAt!: Date | null;

  @CreateDateColumn({ name: 'created_at', type: 'timestamptz' })
  createdAt!: Date;

  @UpdateDateColumn({ name: 'updated_at', type: 'timestamptz' })
  updatedAt!: Date;
}

/** Rebuilds the domain aggregate from its persistence model. */
export const toVacationRequest = (record: VacationRequestRecord): VacationRequest =>
  VacationRequest.restore({
    id: record.id,
    userId: record.userId,
    startDate: record.startDate,
    endDate: record.endDate,
    reason: record.reason,
    status: record.status,
    comments: record.comments,
    decidedById: record.decidedById,
    decidedAt: record.decidedAt,
    createdAt: record.createdAt,
    updatedAt: record.updatedAt,
  });
