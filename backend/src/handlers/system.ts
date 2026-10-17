import { HttpResult } from '../http/http-result';
import { defineRouteHandler } from '../http/route-handler';

/** GET /api/v1/health — liveness + database connectivity (for load balancers / uptime checks). */
export const getHealth = defineRouteHandler(async ({ app }) => {
  let database: 'up' | 'down' = 'up';
  try {
    await app.dataSource.query('SELECT 1');
  } catch {
    database = 'down';
  }
  const healthy = database === 'up';
  return new HttpResult(healthy ? 200 : 503, {
    status: healthy ? 'ok' : 'degraded',
    database,
    uptimeSeconds: Math.round(process.uptime()),
    timestamp: new Date().toISOString(),
  });
});
