import { http } from './http';
import type {
  AdminListParams,
  AuthSession,
  ListParams,
  TeamCalendar,
  User,
  UserRole,
  VacationRequest,
  VacationRequestInput,
  VacationRequestPage,
  VacationRequestStats,
} from './types';

/** Typed wrappers around every REST endpoint, grouped by resource. */

export const authApi = {
  login: (email: string, password: string) =>
    http.post<AuthSession>('/auth/login', { email, password }).then((r) => r.data),
  me: () => http.get<User>('/auth/me').then((r) => r.data),
};

export const myRequestsApi = {
  list: (params: ListParams) =>
    http.get<VacationRequestPage>('/me/vacation-requests', { params }).then((r) => r.data),
  stats: () => http.get<VacationRequestStats>('/me/vacation-requests/stats').then((r) => r.data),
};

export const vacationRequestsApi = {
  list: (params: AdminListParams) =>
    http.get<VacationRequestPage>('/vacation-requests', { params }).then((r) => r.data),
  stats: () => http.get<VacationRequestStats>('/vacation-requests/stats').then((r) => r.data),
  get: (id: string) => http.get<VacationRequest>(`/vacation-requests/${id}`).then((r) => r.data),
  create: (input: VacationRequestInput) =>
    http.post<VacationRequest>('/vacation-requests', input).then((r) => r.data),
  update: (id: string, input: VacationRequestInput) =>
    http.put<VacationRequest>(`/vacation-requests/${id}`, input).then((r) => r.data),
  cancel: (id: string) => http.delete<void>(`/vacation-requests/${id}`).then(() => undefined),
  approve: (id: string, comment?: string) =>
    http
      .post<VacationRequest>(`/vacation-requests/${id}/approve`, { comment: comment || null })
      .then((r) => r.data),
  reject: (id: string, comment: string) =>
    http.post<VacationRequest>(`/vacation-requests/${id}/reject`, { comment }).then((r) => r.data),
};

export const teamCalendarApi = {
  get: (from: string, to: string) =>
    http.get<TeamCalendar>('/team-calendar', { params: { from, to } }).then((r) => r.data),
};

export const usersApi = {
  list: (role?: UserRole) =>
    http.get<{ data: User[] }>('/users', { params: { role } }).then((r) => r.data.data),
};
