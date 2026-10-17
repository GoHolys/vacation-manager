import { randomUUID } from 'node:crypto';
import {
  type APIGatewayProxyStructuredResultV2,
  getRouteConfig,
  resolveHandlerRef,
  Response,
} from 'commoneventframework';
import type { CommonEvent } from 'commoneventframework/dist/types/commonEvent';
import type { Application } from '../bootstrap/application';
import { AppError, ForbiddenError, NotFoundError, TooManyRequestsError } from '../core/errors';
import { HttpResult } from './http-result';
import { getHeader } from './request';
import { createHandlerContext, type RouteHandlerFn } from './route-handler';
import type { RouteSecurity } from './route-security';

export type HttpResponse = APIGatewayProxyStructuredResultV2;

export interface HttpKernelOptions {
  routeSecurity: RouteSecurity;
  getApplication: () => Promise<Application>;
}

const REQUEST_ID_PATTERN = /^[\w-]{1,100}$/;

/**
 * HTTP pipeline built on the Common Event Framework.
 *
 * CEF normalises every AWS event source into a `CommonEvent`, matches it against the routes of
 * `root.yaml` and resolves `x-handler` / `x-inputParser` references. This kernel adds what a
 * production API needs around that core, in this order:
 *
 *   request id → route resolution → authentication → RBAC → input validation → handler
 *   → uniform JSON responses, security/CORS headers, error mapping and access logging.
 */
export function createHttpKernel({ routeSecurity, getApplication }: HttpKernelOptions) {
  return async function handle(event: CommonEvent): Promise<HttpResponse> {
    const startedAt = performance.now();
    const incomingId = getHeader(event, 'x-request-id');
    const requestId = incomingId && REQUEST_ID_PATTERN.test(incomingId) ? incomingId : randomUUID();

    let app: Application | undefined;
    let userId: string | undefined;
    let response: HttpResponse;

    try {
      app = await getApplication();
      const headers = baseHeaders(app.config.corsOrigin, requestId);

      if (event.method === 'OPTIONS') {
        return { statusCode: 204, headers, body: '' };
      }

      const route = getRouteConfig(event);
      if (!route?.handler) {
        throw new NotFoundError(`No route matches ${event.method} ${event.path}`, 'ROUTE_NOT_FOUND');
      }

      const policy = routeSecurity.policyFor(route);
      // Framework introspection routes (/doc, /context, /dependencies) are dev-only.
      if (policy.builtin && app.config.env === 'production') {
        throw new NotFoundError(`No route matches ${event.method} ${event.path}`, 'ROUTE_NOT_FOUND');
      }

      const handler = resolveHandlerRef(route.handler) as RouteHandlerFn | undefined;
      if (!handler) throw new Error(`Handler "${route.handler}" could not be resolved`);

      // 1. Authentication + 2. role-based access control — *before* touching the input.
      const principal = policy.isPublic
        ? undefined
        : await app.authenticator.authenticate(getHeader(event, 'authorization'));
      userId = principal?.id;
      if (principal && !policy.roles.includes(principal.role)) {
        throw new ForbiddenError('Your role does not allow this action', 'INSUFFICIENT_ROLE');
      }

      // 3. Input validation (CEF x-inputParser).
      const parser = route.inputParser ? resolveHandlerRef(route.inputParser) : undefined;
      const input: unknown = parser ? parser(event) : undefined;
      if (input instanceof Response) {
        response = input;
      } else {
        // 4. Handler.
        const result = await handler(input, event, createHandlerContext(app, requestId, principal));
        response = toHttpResponse(result, headers);
      }
    } catch (error) {
      response = toErrorResponse(error, requestId, app);
    }

    const durationMs = Math.round(performance.now() - startedAt);
    const status = response.statusCode ?? 200;
    const log = { method: event.method, path: event.path, status, durationMs, requestId, userId };
    if (app) {
      if (status >= 500) app.logger.error(log, 'request failed');
      else app.logger.info(log, 'request completed');
    }
    return response;
  };
}

function baseHeaders(corsOrigin: string, requestId: string): Record<string, string> {
  return {
    'Access-Control-Allow-Origin': corsOrigin,
    'Access-Control-Allow-Methods': 'OPTIONS,GET,POST,PUT,DELETE',
    'Access-Control-Allow-Headers': 'Content-Type,Authorization,X-Request-Id',
    'Access-Control-Expose-Headers': 'X-Request-Id,Location,Retry-After',
    'Access-Control-Max-Age': '600',
    Vary: 'Origin',
    'Cache-Control': 'no-store',
    'X-Content-Type-Options': 'nosniff',
    'X-Frame-Options': 'DENY',
    'Referrer-Policy': 'no-referrer',
    'X-Request-Id': requestId,
  };
}

function toHttpResponse(result: unknown, headers: Record<string, string>): HttpResponse {
  if (result instanceof HttpResult) {
    const merged = { ...headers, ...result.headers };
    if (result.status === 204 || result.body === undefined) {
      return { statusCode: result.status, headers: merged, body: '' };
    }
    return new Response(result.status, result.body as object, merged);
  }
  // Framework built-ins (Swagger UI, spec…) already return a complete API Gateway result.
  if (result && typeof result === 'object' && 'statusCode' in result) {
    return result as HttpResponse;
  }
  return new Response(200, (result ?? {}) as object, headers);
}

function toErrorResponse(error: unknown, requestId: string, app?: Application): HttpResponse {
  const headers = baseHeaders(app?.config.corsOrigin ?? '*', requestId);

  if (error instanceof AppError) {
    if (error instanceof TooManyRequestsError) {
      headers['Retry-After'] = String(error.retryAfterSeconds);
    }
    return new Response(
      error.status,
      {
        error: {
          code: error.code,
          message: error.message,
          ...(error.details?.length ? { details: error.details } : {}),
          requestId,
        },
      },
      headers,
    );
  }

  // Unexpected failure: log everything, disclose nothing.
  if (app) app.logger.error({ err: error, requestId }, 'unhandled error');
  else console.error('[http] unhandled error before application start-up', error);

  return new Response(
    500,
    { error: { code: 'INTERNAL_ERROR', message: 'An unexpected error occurred', requestId } },
    headers,
  );
}
