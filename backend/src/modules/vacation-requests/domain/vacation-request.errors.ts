import {
  BusinessRuleViolationError,
  ConflictError,
  ForbiddenError,
  NotFoundError,
  ValidationError,
} from '../../../core/errors';
import type { VacationRequestStatus } from './vacation-request-status';

export interface ConflictingRequest {
  id: string;
  startDate: string;
  endDate: string;
  status: VacationRequestStatus;
}

/**
 * Catalogue of every vacation-request business-rule failure. Each has a stable `code`
 * the frontend can rely on, plus a human-readable message.
 */
export const VacationRequestErrors = {
  invalidDate: (field: 'startDate' | 'endDate', value: string) =>
    new ValidationError([{ field, message: `"${value}" is not a valid date (YYYY-MM-DD)` }]),

  textTooLong: (field: 'reason' | 'comment', maxLength: number) =>
    new ValidationError([{ field, message: `Must be at most ${maxLength} characters` }]),

  /** Business rule #1 */
  endDateNotAfterStartDate: () =>
    new BusinessRuleViolationError(
      'END_DATE_NOT_AFTER_START_DATE',
      'The end date must be after the start date.',
      [{ field: 'endDate', message: 'Must be after the start date' }],
    ),

  /** Business rule #2 */
  overlap: (conflicts: ConflictingRequest[]) =>
    new ConflictError(
      'VACATION_OVERLAP',
      'These dates overlap with another of your pending or approved vacation requests.',
      conflicts.map((conflict) => ({
        message: `Overlaps ${conflict.startDate} → ${conflict.endDate} (${conflict.status})`,
        requestId: conflict.id,
        startDate: conflict.startDate,
        endDate: conflict.endDate,
        status: conflict.status,
      })),
    ),

  /** Business rule #3 */
  approvedNotModifiable: () =>
    new ConflictError('REQUEST_NOT_MODIFIABLE', 'Approved vacation requests cannot be modified.'),

  /** Business rule #4 */
  startDateInPast: () =>
    new BusinessRuleViolationError(
      'START_DATE_IN_PAST',
      'Vacation requests cannot start in the past.',
      [{ field: 'startDate', message: 'Must be today or later' }],
    ),

  /** Business rule #5 */
  rejectionCommentRequired: () =>
    new BusinessRuleViolationError(
      'REJECTION_COMMENT_REQUIRED',
      'A comment explaining the rejection is required.',
      [{ field: 'comment', message: 'A rejection comment is required' }],
    ),

  /** Business rule #6 */
  onlyValidatorsCanDecide: () =>
    new ForbiddenError(
      'Only validators can approve or reject vacation requests.',
      'VALIDATOR_ROLE_REQUIRED',
    ),

  onlyRequestersCanSubmit: () =>
    new ForbiddenError('Only requesters can submit vacation requests.', 'REQUESTER_ROLE_REQUIRED'),

  alreadyDecided: (status: VacationRequestStatus) =>
    new ConflictError(
      'REQUEST_ALREADY_DECIDED',
      `This request has already been ${status}; only pending requests can be reviewed.`,
    ),

  notOwner: () =>
    new ForbiddenError('You can only manage your own vacation requests.', 'NOT_REQUEST_OWNER'),

  notFound: () => new NotFoundError('Vacation request not found.', 'VACATION_REQUEST_NOT_FOUND'),
};
