import type { CommonEvent } from 'commoneventframework/dist/types/commonEvent';
import type { Application } from '../bootstrap/application';
import { UnauthorizedError } from '../core/errors';
import type { Principal } from '../modules/auth/application/ports';
import type { HttpResult } from './http-result';
import type { InputParser } from './input-parser';

export interface HandlerContext {
  requestId: string;
  app: Application;
  /** The authenticated caller, or `undefined` on public routes. */
  principal: Principal | undefined;
  /** Client IP — only set when TRUST_PROXY is enabled (taken from X-Forwarded-For). */
  clientIp: string | undefined;
  /** The authenticated caller — throws on public routes. */
  user(): Principal;
}

/** Signature the kernel uses to invoke handlers resolved from `x-handler`. */
export type RouteHandlerFn = (
  input: unknown,
  event: CommonEvent,
  context: HandlerContext,
) => Promise<HttpResult>;

/**
 * Declares a route handler, typing its input from the matching `x-inputParser` so the
 * parser and the handler can never drift apart.
 */
export function defineRouteHandler<P extends InputParser>(
  parser: P,
  handle: (input: ReturnType<P>, context: HandlerContext) => Promise<HttpResult>,
): RouteHandlerFn;
export function defineRouteHandler(
  handle: (context: HandlerContext) => Promise<HttpResult>,
): RouteHandlerFn;
export function defineRouteHandler(
  parserOrHandle: InputParser | ((context: HandlerContext) => Promise<HttpResult>),
  maybeHandle?: (input: never, context: HandlerContext) => Promise<HttpResult>,
): RouteHandlerFn {
  if (maybeHandle) {
    return (input, _event, context) => maybeHandle(input as never, context);
  }
  const handle = parserOrHandle as (context: HandlerContext) => Promise<HttpResult>;
  return (_input, _event, context) => handle(context);
}

export function createHandlerContext(
  app: Application,
  requestId: string,
  principal: Principal | undefined,
  clientIp?: string,
): HandlerContext {
  return {
    app,
    requestId,
    principal,
    clientIp,
    user() {
      if (!principal) throw new UnauthorizedError();
      return principal;
    },
  };
}
