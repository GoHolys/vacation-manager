import { AxiosError, AxiosHeaders } from 'axios';
import { describe, expect, it } from 'vitest';
import { ApiError, toApiError } from './http';

const axiosError = (status?: number, data?: unknown, code?: string) => {
  const config = { headers: new AxiosHeaders() };
  return new AxiosError(
    'failed',
    code,
    config,
    {},
    status ? { status, data, statusText: '', headers: {}, config } : undefined,
  );
};

describe('toApiError', () => {
  it('maps the API error envelope, including field errors', () => {
    const error = toApiError(
      axiosError(422, {
        error: {
          code: 'END_DATE_NOT_AFTER_START_DATE',
          message: 'The end date must be after the start date.',
          details: [{ field: 'endDate', message: 'Must be after the start date' }],
          requestId: 'req-1',
        },
      }),
    );
    expect(error).toBeInstanceOf(ApiError);
    expect(error).toMatchObject({
      status: 422,
      code: 'END_DATE_NOT_AFTER_START_DATE',
      requestId: 'req-1',
    });
    expect(error.fieldErrors).toEqual({ endDate: 'Must be after the start date' });
  });

  it('turns network failures and timeouts into actionable messages', () => {
    expect(toApiError(axiosError()).code).toBe('NETWORK_ERROR');
    expect(toApiError(axiosError(undefined, undefined, AxiosError.ECONNABORTED)).code).toBe(
      'TIMEOUT',
    );
    expect(toApiError(axiosError(502, '<html>')).code).toBe('HTTP_ERROR');
  });
});
