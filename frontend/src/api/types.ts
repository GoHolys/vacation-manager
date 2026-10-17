/**
 * Domain types, derived from the backend's OpenAPI contract (`backend/src/root.yaml`) by
 * `npm run codegen:api`. If the API changes shape, the frontend stops compiling — by design.
 */
import type { components } from './generated/schema';

type Schemas = components['schemas'];

export type User = Schemas['User'];
export type UserRole = Schemas['UserRole'];
export type UserSummary = Schemas['UserSummary'];
export type AuthSession = Schemas['AuthSession'];
export type VacationRequest = Schemas['VacationRequest'];
export type VacationRequestStatus = Schemas['VacationRequestStatus'];
export type VacationRequestInput = Schemas['VacationRequestInput'];
export type VacationRequestPage = Schemas['VacationRequestPage'];
export type VacationRequestStats = Schemas['VacationRequestStats'];
export type PageMeta = Schemas['PageMeta'];
export type TeamCalendar = Schemas['TeamCalendar'];
export type CalendarEntry = Schemas['CalendarEntry'];
export type TeamMember = Schemas['TeamMember'];
export type ErrorResponse = Schemas['ErrorResponse'];
export type ErrorDetail = Schemas['ErrorDetail'];

export type SortField = 'createdAt' | 'startDate';
export type SortOrder = 'asc' | 'desc';

export interface ListParams {
  page?: number;
  pageSize?: number;
  status?: VacationRequestStatus;
  sort?: SortField;
  order?: SortOrder;
}

export interface AdminListParams extends ListParams {
  userId?: string;
}
