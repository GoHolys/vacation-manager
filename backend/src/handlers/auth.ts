import { ok } from '../http/http-result';
import { defineInputParser } from '../http/input-parser';
import { defineRouteHandler } from '../http/route-handler';
import { AuthenticateUserCommand } from '../modules/auth/application/commands/authenticate-user.command';
import { GetUserQuery } from '../modules/users/application/queries/get-user.query';
import { loginBody } from './schemas';

/** POST /api/v1/auth/login */
export const parseLogin = defineInputParser({ body: loginBody });

export const login = defineRouteHandler(parseLogin, async ({ body }, { app }) =>
  ok(await app.commandBus.execute(new AuthenticateUserCommand(body.email, body.password))),
);

/** GET /api/v1/auth/me */
export const getCurrentUser = defineRouteHandler(async (ctx) =>
  ok(await ctx.app.queryBus.execute(new GetUserQuery(ctx.user().id))),
);
