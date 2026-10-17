import { z } from 'zod';
import { ok } from '../http/http-result';
import { defineInputParser } from '../http/input-parser';
import { defineRouteHandler } from '../http/route-handler';
import { ListUsersQuery } from '../modules/users/application/queries/list-users.query';
import { roleFilter } from './schemas';

/** GET /api/v1/users?role=requester — feeds the validator dashboard's user filter. */
export const parseListUsers = defineInputParser({ query: z.object({ role: roleFilter }) });

export const listUsers = defineRouteHandler(parseListUsers, async ({ query }, { app }) =>
  ok({ data: await app.queryBus.execute(new ListUsersQuery(query.role)) }),
);
