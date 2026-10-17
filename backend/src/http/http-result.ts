/**
 * Transport-agnostic result returned by route handlers. The kernel turns it into a
 * Common Event Framework `Response` (API Gateway compatible).
 */
export class HttpResult {
  constructor(
    readonly status: number,
    readonly body?: unknown,
    readonly headers: Record<string, string> = {},
  ) {}
}

export const ok = (body: unknown): HttpResult => new HttpResult(200, body);

export const created = (body: unknown, location?: string): HttpResult =>
  new HttpResult(201, body, location ? { Location: location } : {});

export const noContent = (): HttpResult => new HttpResult(204);
