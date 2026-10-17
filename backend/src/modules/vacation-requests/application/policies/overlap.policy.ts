import type { VacationRequestRepository } from '../ports';
import type { VacationPeriod } from '../../domain/vacation-period';
import { VacationRequestErrors } from '../../domain/vacation-request.errors';

/**
 * Business rule #2 — a user cannot hold two pending/approved requests for overlapping days.
 *
 * This check yields a friendly error listing the conflicting requests. The database exclusion
 * constraint `ex_vacation_requests_no_overlap` remains the ultimate guarantee for concurrent writes.
 */
export async function assertNoOverlap(
  repository: VacationRequestRepository,
  userId: string,
  period: VacationPeriod,
  excludeRequestId?: string,
): Promise<void> {
  const conflicts = await repository.findOverlapping(userId, period, excludeRequestId);
  if (conflicts.length > 0) {
    throw VacationRequestErrors.overlap(
      conflicts.map(({ id, startDate, endDate, status }) => ({ id, startDate, endDate, status })),
    );
  }
}
