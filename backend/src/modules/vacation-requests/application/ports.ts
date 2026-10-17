import type { IsoDate } from '../../../core/iso-date';
import type { PageRequest } from '../../../core/pagination';
import type { UserRepository } from '../../users/application/user.repository';
import type { User } from '../../users/domain/user.entity';
import type { VacationPeriod } from '../domain/vacation-period';
import type { VacationRequest } from '../domain/vacation-request.entity';
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
  save(request: VacationRequest): Promise<VacationRequest>;
  remove(request: VacationRequest): Promise<void>;
}

/** Repositories available inside a vacation-request unit of work (one DB transaction). */
export interface VacationRequestsScope {
  vacationRequests: VacationRequestRepository;
  users: UserRepository;
}

// ─── Read side ────────────────────────────────────────────────────────────────

export type VacationRequestSortField = 'createdAt' | 'startDate';
export type SortOrder = 'asc' | 'desc';

export interface VacationRequestListCriteria {
  userId?: string;
  status?: VacationRequestStatus;
  sort: VacationRequestSortField;
  order: SortOrder;
}

/** A vacation request with its `user` and `decidedBy` relations loaded. */
export type VacationRequestView = VacationRequest & { user: User; decidedBy: User | null };

export type StatusCounts = Record<VacationRequestStatus, number>;

export interface VacationRequestReadModel {
  findById(id: string): Promise<VacationRequestView | null>;
  list(
    criteria: VacationRequestListCriteria,
    page: PageRequest,
  ): Promise<{ items: VacationRequestView[]; total: number }>;
  countByStatus(userId?: string): Promise<StatusCounts>;
  /** Pending + approved requests intersecting the inclusive [from, to] window. */
  findBlockingInRange(from: IsoDate, to: IsoDate): Promise<VacationRequest[]>;
}
