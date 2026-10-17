import axios, { AxiosError, type AxiosInstance } from 'axios';
import type { ErrorDetail, ErrorResponse } from './types';

/** Normalised error for every failed API call — views never deal with raw Axios errors. */
export class ApiError extends Error {
  constructor(
    readonly status: number,
    readonly code: string,
    message: string,
    readonly details: ErrorDetail[] = [],
    readonly requestId?: string,
  ) {
    super(message);
    this.name = 'ApiError';
  }

  /** Field-level messages keyed by field name (e.g. `{ endDate: 'Must be after…' }`). */
  get fieldErrors(): Record<string, string> {
    const errors: Record<string, string> = {};
    for (const detail of this.details) {
      if (detail.field && !errors[detail.field]) errors[detail.field] = detail.message;
    }
    return errors;
  }
}

export function toApiError(error: unknown): ApiError {
  if (error instanceof ApiError) return error;
  if (error instanceof AxiosError) {
    const body = error.response?.data as Partial<ErrorResponse> | undefined;
    if (error.response && body?.error) {
      const { code, message, details, requestId } = body.error;
      return new ApiError(error.response.status, code, message, details, requestId);
    }
    if (error.response) {
      return new ApiError(
        error.response.status,
        'HTTP_ERROR',
        'The server returned an unexpected response.',
      );
    }
    if (error.code === AxiosError.ECONNABORTED) {
      return new ApiError(0, 'TIMEOUT', 'The server took too long to respond. Try again.');
    }
    return new ApiError(
      0,
      'NETWORK_ERROR',
      "Can't reach the server. Check your connection and try again.",
    );
  }
  return new ApiError(
    0,
    'UNKNOWN',
    error instanceof Error ? error.message : 'Something went wrong.',
  );
}

let accessToken: string | null = null;
let onUnauthorized: (() => void) | null = null;

export const setAccessToken = (token: string | null): void => {
  accessToken = token;
};

/** Called when an authenticated request is rejected with 401 (expired or revoked session). */
export const setUnauthorizedHandler = (handler: (() => void) | null): void => {
  onUnauthorized = handler;
};

export const http: AxiosInstance = axios.create({
  baseURL: `${import.meta.env.VITE_API_BASE_URL ?? ''}/api/v1`,
  timeout: 15_000,
  headers: { 'Content-Type': 'application/json', Accept: 'application/json' },
});

http.interceptors.request.use((config) => {
  if (accessToken) config.headers.Authorization = `Bearer ${accessToken}`;
  return config;
});

http.interceptors.response.use(
  (response) => response,
  (error: unknown) => {
    const apiError = toApiError(error);
    const hadToken = error instanceof AxiosError && Boolean(error.config?.headers?.Authorization);
    if (apiError.status === 401 && hadToken) onUnauthorized?.();
    return Promise.reject(apiError);
  },
);
