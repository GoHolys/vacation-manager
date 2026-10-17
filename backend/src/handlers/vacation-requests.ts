import { z } from 'zod';
import { created, noContent, ok } from '../http/http-result';
import { defineInputParser } from '../http/input-parser';
import { defineRouteHandler, type HandlerContext } from '../http/route-handler';
import { ApproveVacationRequestCommand } from '../modules/vacation-requests/application/commands/approve-vacation-request.command';
import { CancelVacationRequestCommand } from '../modules/vacation-requests/application/commands/cancel-vacation-request.command';
import { CreateVacationRequestCommand } from '../modules/vacation-requests/application/commands/create-vacation-request.command';
import { RejectVacationRequestCommand } from '../modules/vacation-requests/application/commands/reject-vacation-request.command';
import { UpdateVacationRequestCommand } from '../modules/vacation-requests/application/commands/update-vacation-request.command';
import { GetVacationRequestQuery } from '../modules/vacation-requests/application/queries/get-vacation-request.query';
import { GetVacationRequestStatsQuery } from '../modules/vacation-requests/application/queries/get-vacation-request-stats.query';
import { ListVacationRequestsQuery } from '../modules/vacation-requests/application/queries/list-vacation-requests.query';
import {
  decisionBody,
  idParams,
  paginationQuery,
  statusFilter,
  vacationRequestBody,
} from './schemas';

/**
 * Vacation request routes. Each handler is a thin adapter: it maps validated HTTP input to a
 * Command or Query, dispatches it on the matching bus and maps the result to an HTTP response.
 * Authentication and role checks were already applied by the kernel from `x-roles`.
 */

const BASE_PATH = '/api/v1/vacation-requests';

/** Reads back the freshly written request so every mutation returns the full resource. */
const fetchRequest = (ctx: HandlerContext, requestId: string) =>
  ctx.app.queryBus.execute(new GetVacationRequestQuery(requestId, ctx.user()));

// ─── Requester ────────────────────────────────────────────────────────────────

/** GET /api/v1/me/vacation-requests */
export const parseListMyVacationRequests = defineInputParser({
  query: paginationQuery.extend({ status: statusFilter }),
});

export const listMyVacationRequests = defineRouteHandler(
  parseListMyVacationRequests,
  async ({ query }, ctx) => {
    const { page, pageSize, sort, order, status } = query;
    return ok(
      await ctx.app.queryBus.execute(
        new ListVacationRequestsQuery(
          { userId: ctx.user().id, status, sort, order },
          { page, pageSize },
        ),
      ),
    );
  },
);

/** GET /api/v1/me/vacation-requests/stats */
export const getMyVacationRequestStats = defineRouteHandler(async (ctx) =>
  ok(await ctx.app.queryBus.execute(new GetVacationRequestStatsQuery(ctx.user().id))),
);

/** POST /api/v1/vacation-requests */
export const parseCreateVacationRequest = defineInputParser({ body: vacationRequestBody });

export const createVacationRequest = defineRouteHandler(
  parseCreateVacationRequest,
  async ({ body }, ctx) => {
    const { id } = await ctx.app.commandBus.execute(
      new CreateVacationRequestCommand(ctx.user().id, body.startDate, body.endDate, body.reason),
    );
    return created(await fetchRequest(ctx, id), `${BASE_PATH}/${id}`);
  },
);

/** PUT /api/v1/vacation-requests/:id */
export const parseUpdateVacationRequest = defineInputParser({
  params: idParams,
  body: vacationRequestBody,
});

export const updateVacationRequest = defineRouteHandler(
  parseUpdateVacationRequest,
  async ({ params, body }, ctx) => {
    await ctx.app.commandBus.execute(
      new UpdateVacationRequestCommand(
        ctx.user().id,
        params.id,
        body.startDate,
        body.endDate,
        body.reason,
      ),
    );
    return ok(await fetchRequest(ctx, params.id));
  },
);

/** DELETE /api/v1/vacation-requests/:id */
export const parseVacationRequestId = defineInputParser({ params: idParams });

export const cancelVacationRequest = defineRouteHandler(
  parseVacationRequestId,
  async ({ params }, ctx) => {
    await ctx.app.commandBus.execute(new CancelVacationRequestCommand(ctx.user().id, params.id));
    return noContent();
  },
);

// ─── Shared (requester: own requests only; validator: any) ────────────────────

/** GET /api/v1/vacation-requests/:id */
export const getVacationRequest = defineRouteHandler(
  parseVacationRequestId,
  async ({ params }, ctx) => ok(await fetchRequest(ctx, params.id)),
);

// ─── Validator ────────────────────────────────────────────────────────────────

/** GET /api/v1/vacation-requests */
export const parseListVacationRequests = defineInputParser({
  query: paginationQuery.extend({ status: statusFilter, userId: z.uuid().optional() }),
});

export const listVacationRequests = defineRouteHandler(
  parseListVacationRequests,
  async ({ query }, ctx) => {
    const { page, pageSize, sort, order, status, userId } = query;
    return ok(
      await ctx.app.queryBus.execute(
        new ListVacationRequestsQuery({ userId, status, sort, order }, { page, pageSize }),
      ),
    );
  },
);

/** GET /api/v1/vacation-requests/stats */
export const getVacationRequestStats = defineRouteHandler(async (ctx) =>
  ok(await ctx.app.queryBus.execute(new GetVacationRequestStatsQuery())),
);

/** POST /api/v1/vacation-requests/:id/approve */
export const parseDecision = defineInputParser({ params: idParams, body: decisionBody });

export const approveVacationRequest = defineRouteHandler(
  parseDecision,
  async ({ params, body }, ctx) => {
    await ctx.app.commandBus.execute(
      new ApproveVacationRequestCommand(ctx.user().id, params.id, body.comment),
    );
    return ok(await fetchRequest(ctx, params.id));
  },
);

/** POST /api/v1/vacation-requests/:id/reject — the comment requirement is a domain rule (#5). */
export const rejectVacationRequest = defineRouteHandler(
  parseDecision,
  async ({ params, body }, ctx) => {
    await ctx.app.commandBus.execute(
      new RejectVacationRequestCommand(ctx.user().id, params.id, body.comment ?? ''),
    );
    return ok(await fetchRequest(ctx, params.id));
  },
);
