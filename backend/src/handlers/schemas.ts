import { z } from 'zod';
import { isIsoDate } from '../core/iso-date';
import { DEFAULT_PAGE_SIZE, MAX_PAGE_SIZE } from '../core/pagination';
import { USER_ROLES } from '../modules/users/domain/user-role';
import {
  COMMENT_MAX_LENGTH,
  REASON_MAX_LENGTH,
} from '../modules/vacation-requests/domain/vacation-request.entity';
import { VACATION_REQUEST_STATUSES } from '../modules/vacation-requests/domain/vacation-request-status';

/** Reusable request schemas (shape & format only — business rules live in the domain). */

export const isoDate = z
  .string({ error: 'Required' })
  .refine(isIsoDate, 'Must be a valid date in YYYY-MM-DD format');

export const idParams = z.object({ id: z.uuid('Must be a valid UUID') });

export const paginationQuery = z.object({
  page: z.coerce.number().int().min(1).default(1),
  pageSize: z.coerce.number().int().min(1).max(MAX_PAGE_SIZE).default(DEFAULT_PAGE_SIZE),
  sort: z.enum(['createdAt', 'startDate']).default('createdAt'),
  order: z.enum(['asc', 'desc']).default('desc'),
});

export const statusFilter = z.enum(VACATION_REQUEST_STATUSES).optional();

export const vacationRequestBody = z.object({
  startDate: isoDate,
  endDate: isoDate,
  reason: z
    .string()
    .max(REASON_MAX_LENGTH, `Must be at most ${REASON_MAX_LENGTH} characters`)
    .nullish(),
});

export const decisionBody = z.object({
  comment: z
    .string()
    .max(COMMENT_MAX_LENGTH, `Must be at most ${COMMENT_MAX_LENGTH} characters`)
    .nullish(),
});

export const loginBody = z.object({
  email: z.email('Must be a valid email address').max(254),
  password: z.string({ error: 'Required' }).min(1, 'Required').max(200),
});

export const roleFilter = z.enum(USER_ROLES).optional();
