export const VacationRequestStatus = {
  PENDING: 'pending',
  APPROVED: 'approved',
  REJECTED: 'rejected',
} as const;

export type VacationRequestStatus =
  (typeof VacationRequestStatus)[keyof typeof VacationRequestStatus];

export const VACATION_REQUEST_STATUSES = Object.values(
  VacationRequestStatus,
) as readonly VacationRequestStatus[];

/** Statuses that "hold" calendar days — a rejected request frees its period. */
export const BLOCKING_STATUSES: readonly VacationRequestStatus[] = [
  VacationRequestStatus.PENDING,
  VacationRequestStatus.APPROVED,
];
