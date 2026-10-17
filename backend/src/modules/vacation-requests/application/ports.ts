import type { IsoDate } from '../../../core/iso-date';
import type { PageRequest } from '../../../core/pagination';
import type { UserRepository } from '../../users/application/user.repository';
import type { VacationPeriod } from '../domain/vacation-period';
import type { VacationRequest } from '../domain/vacation-request';
import type { VacationRequestStatus } from '../domain/vacation-request-status';

// ─── Write side ───────────────────────────────────────────────────────────────

export interface VacationRequestRepository {
  /** @param options.lock acquire a row lock (`SELECT … FOR UPDATE`) for the rest of the transaction. */
  findById(id: string, options?: { lock?: boolean }): Promise<VacationRequest | null>;
  /** Pending/approved requests of `userId` overlapping `period` (optionally excluding one request). */
  findOverlapping(
    userId: string,
    period: VacationPeriod,
    excludeRequestId?: string,
  ): Promise<VacationRequest[]>;
  /** Persists a newly submitted request. */
  add(request: VacationRequest): Promise<void>;
  /** Persists the current state of an existing request. */
  save(request: VacationRequest): Promise<void>;
  remove(request: VacationRequest): Promise<void>;
}

/** Repositories available inside a vacation-request unit of work (one DB transaction). */
export interface VacationRequestsScope {
  vacationRequests: VacationRequestRepository;
  users: UserRepository;
}

// ─── Read side ────────────────────────────────────────────────────────────────
// Queries never load aggregates: the read model returns flat views shaped for the screens.

export type VacationRequestSortField = 'createdAt' | 'startDate';
export type SortOrder = 'asc' | 'desc';

export interface VacationRequestListCriteria {
  userId?: string;
  status?: VacationRequestStatus;
  sort: VacationRequestSortField;
  order: SortOrder;
}

export interface UserSummaryView {
  id: string;
  name: string;
  email: string;
}

/** A vacation request joined with its requester and deciding validator. */
export interface VacationRequestView {
  id: string;
  userId: string;
  startDate: IsoDate;
  endDate: IsoDate;
  reason: string | null;
  status: VacationRequestStatus;
  comments: string | null;
  decidedAt: Date | null;
  createdAt: Date;
  updatedAt: Date;
  user: UserSummaryView;
  decidedBy: UserSummaryView | null;
}

/** What the team calendar may show: when someone is away, never why. */
export interface CalendarEntryView {
  id: string;
  userId: string;
  startDate: IsoDate;
  endDate: IsoDate;
  status: VacationRequestStatus;
}

export type StatusCounts = Record<VacationRequestStatus, number>;

export interface VacationRequestReadModel {
  findById(id: string): Promise<VacationRequestView | null>;
  list(
    criteria: VacationRequestListCriteria,
    page: PageRequest,
  ): Promise<{ items: VacationRequestView[]; total: number }>;
  countByStatus(userId?: string): Promise<StatusCounts>;
  /** Pending + approved requests intersecting the inclusive [from, to] window. */
  findBlockingInRange(from: IsoDate, to: IsoDate): Promise<CalendarEntryView[]>;
}
