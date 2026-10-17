import { daysInclusive } from '../../../core/iso-date';
import type { VacationRequestStatus } from '../domain/vacation-request-status';
import type { VacationRequestView } from './ports';

export interface UserSummaryDto {
  id: string;
  name: string;
  email: string;
}

export interface VacationRequestDto {
  id: string;
  startDate: string;
  endDate: string;
  /** Calendar days covered, both ends inclusive. */
  days: number;
  reason: string | null;
  status: VacationRequestStatus;
  comments: string | null;
  requester: UserSummaryDto;
  decidedBy: UserSummaryDto | null;
  decidedAt: string | null;
  createdAt: string;
  updatedAt: string;
}

export const toVacationRequestDto = (request: VacationRequestView): VacationRequestDto => ({
  id: request.id,
  startDate: request.startDate,
  endDate: request.endDate,
  days: daysInclusive(request.startDate, request.endDate),
  reason: request.reason,
  status: request.status,
  comments: request.comments,
  requester: { id: request.user.id, name: request.user.name, email: request.user.email },
  decidedBy: request.decidedBy
    ? { id: request.decidedBy.id, name: request.decidedBy.name, email: request.decidedBy.email }
    : null,
  decidedAt: request.decidedAt?.toISOString() ?? null,
  createdAt: request.createdAt.toISOString(),
  updatedAt: request.updatedAt.toISOString(),
});
