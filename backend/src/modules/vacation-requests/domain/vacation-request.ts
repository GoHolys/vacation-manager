import { randomUUID } from 'node:crypto';
import type { DomainEvent, EventRecorder } from '../../../core/domain-event';
import type { IsoDate } from '../../../core/iso-date';
import { VacationPeriod } from './vacation-period';
import { VacationRequestErrors } from './vacation-request.errors';
import {
  VacationRequestApprovedEvent,
  VacationRequestCancelledEvent,
  VacationRequestRejectedEvent,
  VacationRequestSubmittedEvent,
  VacationRequestUpdatedEvent,
} from './vacation-request.events';
import { VacationRequestStatus } from './vacation-request-status';

export const REASON_MAX_LENGTH = 500;
export const COMMENT_MAX_LENGTH = 1000;

export interface VacationRequestProps {
  id: string;
  userId: string;
  startDate: IsoDate;
  endDate: IsoDate;
  reason: string | null;
  status: VacationRequestStatus;
  /** Validator's comment — mandatory when rejected, optional when approved. */
  comments: string | null;
  decidedById: string | null;
  decidedAt: Date | null;
  createdAt: Date;
  updatedAt: Date;
}

/**
 * Vacation request aggregate root — a pure domain object with no framework or persistence
 * dependency (TypeORM mapping lives in `infrastructure/vacation-request.record.ts`).
 *
 * State is private and only changes through intention-revealing methods (`submit`, `reschedule`,
 * `approve`, `reject`, `cancel`) that enforce the business rules. Every state change *records a
 * domain event*; the command handler publishes the recorded events once the transaction has
 * committed, so subscribers only ever see durable facts.
 *
 * Rules owned here: #1 and #4 (through `VacationPeriod`), #3 (approved requests are immutable),
 * #5 (a rejection needs a comment) and the text length limits. Rules that need other data
 * (#2 overlaps, #6 roles) are enforced by the command handlers — and #1, #2, #5 are also
 * database constraints, the last line of defence against races and manual data changes.
 */
export class VacationRequest implements EventRecorder {
  private recordedEvents: DomainEvent[] = [];

  private constructor(private props: VacationRequestProps) {}

  // ─── Factories ──────────────────────────────────────────────────────────────

  /** A requester submits a new request: it starts as pending. */
  static submit(
    input: { userId: string; period: VacationPeriod; reason?: string | null; id?: string },
    now: Date,
  ): VacationRequest {
    const request = new VacationRequest({
      id: input.id ?? randomUUID(),
      userId: input.userId,
      startDate: input.period.startDate,
      endDate: input.period.endDate,
      reason: normalizeText(input.reason, 'reason', REASON_MAX_LENGTH),
      status: VacationRequestStatus.PENDING,
      comments: null,
      decidedById: null,
      decidedAt: null,
      createdAt: now,
      updatedAt: now,
    });
    request.record(VacationRequestSubmittedEvent.from(request));
    return request;
  }

  /** Rebuilds an aggregate from stored state. Runs no creation rules and records no events. */
  static restore(props: VacationRequestProps): VacationRequest {
    return new VacationRequest({ ...props });
  }

  // ─── State (read-only) ──────────────────────────────────────────────────────

  get id(): string {
    return this.props.id;
  }
  get userId(): string {
    return this.props.userId;
  }
  get startDate(): IsoDate {
    return this.props.startDate;
  }
  get endDate(): IsoDate {
    return this.props.endDate;
  }
  get reason(): string | null {
    return this.props.reason;
  }
  get status(): VacationRequestStatus {
    return this.props.status;
  }
  get comments(): string | null {
    return this.props.comments;
  }
  get decidedById(): string | null {
    return this.props.decidedById;
  }
  get decidedAt(): Date | null {
    return this.props.decidedAt;
  }
  get createdAt(): Date {
    return this.props.createdAt;
  }
  get updatedAt(): Date {
    return this.props.updatedAt;
  }
  get period(): VacationPeriod {
    return VacationPeriod.restore(this.props.startDate, this.props.endDate);
  }

  /** An immutable copy of the current state (used by persistence adapters). */
  snapshot(): Readonly<VacationRequestProps> {
    return { ...this.props };
  }

  isOwnedBy(userId: string): boolean {
    return this.props.userId === userId;
  }

  isPending(): boolean {
    return this.props.status === VacationRequestStatus.PENDING;
  }

  // ─── Behaviour ──────────────────────────────────────────────────────────────

  /** Rule #3 — approved requests are immutable. */
  assertModifiable(): void {
    if (this.props.status === VacationRequestStatus.APPROVED) {
      throw VacationRequestErrors.approvedNotModifiable();
    }
  }

  /**
   * Changes dates/reason. Editing a *rejected* request re-submits it for review.
   * @returns whether the request was re-submitted.
   */
  reschedule(
    period: VacationPeriod,
    reason: string | null | undefined,
    now: Date,
  ): { resubmitted: boolean } {
    this.assertModifiable();
    const normalizedReason = normalizeText(reason, 'reason', REASON_MAX_LENGTH);
    const previous = {
      startDate: this.props.startDate,
      endDate: this.props.endDate,
      reason: this.props.reason,
    };
    const resubmitted = this.props.status === VacationRequestStatus.REJECTED;

    this.props = {
      ...this.props,
      startDate: period.startDate,
      endDate: period.endDate,
      reason: normalizedReason,
      updatedAt: now,
      ...(resubmitted && {
        status: VacationRequestStatus.PENDING,
        comments: null,
        decidedById: null,
        decidedAt: null,
      }),
    };
    this.record(VacationRequestUpdatedEvent.from(this, previous, resubmitted));
    return { resubmitted };
  }

  approve(validatorId: string, comment: string | null | undefined, now: Date): void {
    this.assertPending();
    this.props = {
      ...this.props,
      status: VacationRequestStatus.APPROVED,
      comments: normalizeText(comment, 'comment', COMMENT_MAX_LENGTH),
      decidedById: validatorId,
      decidedAt: now,
      updatedAt: now,
    };
    this.record(VacationRequestApprovedEvent.from(this, validatorId));
  }

  /** Rule #5 — a rejection must always be justified. */
  reject(validatorId: string, comment: string | null | undefined, now: Date): void {
    this.assertPending();
    const justification = normalizeText(comment, 'comment', COMMENT_MAX_LENGTH);
    if (!justification) throw VacationRequestErrors.rejectionCommentRequired();
    this.props = {
      ...this.props,
      status: VacationRequestStatus.REJECTED,
      comments: justification,
      decidedById: validatorId,
      decidedAt: now,
      updatedAt: now,
    };
    this.record(VacationRequestRejectedEvent.from(this, validatorId));
  }

  /** The requester withdraws a pending or rejected request; the repository then removes it. */
  cancel(): void {
    this.assertModifiable();
    this.record(VacationRequestCancelledEvent.from(this));
  }

  // ─── Events ─────────────────────────────────────────────────────────────────

  pullEvents(): DomainEvent[] {
    const events = this.recordedEvents;
    this.recordedEvents = [];
    return events;
  }

  private record(event: DomainEvent): void {
    this.recordedEvents.push(event);
  }

  private assertPending(): void {
    if (!this.isPending()) throw VacationRequestErrors.alreadyDecided(this.props.status);
  }
}

/** Trims free text; blank becomes `null`; enforces the maximum length. */
function normalizeText(
  value: string | null | undefined,
  field: 'reason' | 'comment',
  maxLength: number,
): string | null {
  const trimmed = value?.trim();
  if (!trimmed) return null;
  if (trimmed.length > maxLength) throw VacationRequestErrors.textTooLong(field, maxLength);
  return trimmed;
}
