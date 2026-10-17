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
import { User } from '../../users/domain/user.entity';
import { VacationPeriod } from './vacation-period';
import { VacationRequestErrors } from './vacation-request.errors';
import { VACATION_REQUEST_STATUSES, VacationRequestStatus } from './vacation-request-status';

export const REASON_MAX_LENGTH = 500;
export const COMMENT_MAX_LENGTH = 1000;

/**
 * Vacation request aggregate.
 *
 * State transitions are only possible through intention-revealing methods
 * (`submit`, `reschedule`, `approve`, `reject`) that enforce the business rules,
 * so an invalid state can never be persisted from application code. The most critical
 * invariants are *also* enforced by the database (CHECK + EXCLUDE constraints) as a
 * last line of defence against races and manual data changes.
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
export class VacationRequest {
  @PrimaryGeneratedColumn('uuid', { primaryKeyConstraintName: 'pk_vacation_requests' })
  id!: string;

  @Column({ name: 'user_id', type: 'uuid' })
  userId!: string;

  @ManyToOne(() => User, { nullable: false, onDelete: 'CASCADE' })
  @JoinColumn({ name: 'user_id', foreignKeyConstraintName: 'fk_vacation_requests_user' })
  user?: User;

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

  @ManyToOne(() => User, { nullable: true, onDelete: 'SET NULL' })
  @JoinColumn({ name: 'decided_by', foreignKeyConstraintName: 'fk_vacation_requests_decided_by' })
  decidedBy?: User | null;

  @Column({ name: 'decided_at', type: 'timestamptz', nullable: true })
  decidedAt!: Date | null;

  @CreateDateColumn({ name: 'created_at', type: 'timestamptz' })
  createdAt!: Date;

  @UpdateDateColumn({ name: 'updated_at', type: 'timestamptz' })
  updatedAt!: Date;

  // ─── Factory ────────────────────────────────────────────────────────────────

  static submit(props: { userId: string; period: VacationPeriod; reason?: string | null }) {
    const request = new VacationRequest();
    request.userId = props.userId;
    request.startDate = props.period.startDate;
    request.endDate = props.period.endDate;
    request.reason = normalizeText(props.reason);
    request.status = VacationRequestStatus.PENDING;
    request.comments = null;
    request.decidedById = null;
    request.decidedAt = null;
    return request;
  }

  // ─── Queries ────────────────────────────────────────────────────────────────

  get period(): VacationPeriod {
    return VacationPeriod.restore(this.startDate, this.endDate);
  }

  isOwnedBy(userId: string): boolean {
    return this.userId === userId;
  }

  isPending(): boolean {
    return this.status === VacationRequestStatus.PENDING;
  }

  // ─── Commands ───────────────────────────────────────────────────────────────

  /** Rule #3 — approved requests are immutable. */
  assertModifiable(): void {
    if (this.status === VacationRequestStatus.APPROVED) {
      throw VacationRequestErrors.approvedNotModifiable();
    }
  }

  /**
   * Changes dates/reason. Editing a *rejected* request re-submits it for review.
   * @returns whether the request was re-submitted.
   */
  reschedule(period: VacationPeriod, reason?: string | null): { resubmitted: boolean } {
    this.assertModifiable();
    const resubmitted = this.status === VacationRequestStatus.REJECTED;
    this.startDate = period.startDate;
    this.endDate = period.endDate;
    this.reason = normalizeText(reason);
    if (resubmitted) {
      this.status = VacationRequestStatus.PENDING;
      this.comments = null;
      this.decidedById = null;
      this.decidedAt = null;
    }
    return { resubmitted };
  }

  approve(validatorId: string, comment: string | null | undefined, at: Date): void {
    this.assertPending();
    this.status = VacationRequestStatus.APPROVED;
    this.comments = normalizeText(comment);
    this.decidedById = validatorId;
    this.decidedAt = at;
  }

  /** Rule #5 — a rejection must always be justified. */
  reject(validatorId: string, comment: string | null | undefined, at: Date): void {
    this.assertPending();
    const justification = normalizeText(comment);
    if (!justification) throw VacationRequestErrors.rejectionCommentRequired();
    this.status = VacationRequestStatus.REJECTED;
    this.comments = justification;
    this.decidedById = validatorId;
    this.decidedAt = at;
  }

  private assertPending(): void {
    if (!this.isPending()) throw VacationRequestErrors.alreadyDecided(this.status);
  }
}

function normalizeText(value: string | null | undefined): string | null {
  const trimmed = value?.trim();
  return trimmed ? trimmed : null;
}
