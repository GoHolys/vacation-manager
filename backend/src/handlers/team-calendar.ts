import { z } from 'zod';
import type { IsoDate } from '../core/iso-date';
import { ok } from '../http/http-result';
import { defineInputParser } from '../http/input-parser';
import { defineRouteHandler } from '../http/route-handler';
import { GetTeamCalendarQuery } from '../modules/vacation-requests/application/queries/get-team-calendar.query';
import { isoDate } from './schemas';

/** GET /api/v1/team-calendar?from=YYYY-MM-DD&to=YYYY-MM-DD — team planning for both roles. */
export const parseGetTeamCalendar = defineInputParser({
  query: z.object({ from: isoDate, to: isoDate }),
});

export const getTeamCalendar = defineRouteHandler(
  parseGetTeamCalendar,
  async ({ query }, { app }) =>
    ok(
      await app.queryBus.execute(
        new GetTeamCalendarQuery(query.from as IsoDate, query.to as IsoDate),
      ),
    ),
);
