import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest';
import { TestApi } from './harness';

let api: TestApi;
let alice: string; // requester token
let bob: string; // requester token
let victor: string; // validator token

const BASE = '/api/v1/vacation-requests';

beforeAll(async () => {
  api = await TestApi.start();
  [alice, bob, victor] = await Promise.all([
    api.login(api.users.alice),
    api.login(api.users.bob),
    api.login(api.users.victor),
  ]);
});

afterAll(async () => {
  await api?.stop();
});

beforeEach(async () => {
  await api.resetRequests();
});

const submit = (token: string, startDate: string, endDate: string, reason?: string) =>
  api.request('POST', BASE, { token, body: { startDate, endDate, reason } });

describe('platform', () => {
  it('reports health', async () => {
    const response = await api.request('GET', '/api/v1/health');
    expect(response.status).toBe(200);
    expect(response.body).toMatchObject({ status: 'ok', database: 'up' });
  });

  it('adds security headers and a request id to every response', async () => {
    const response = await api.request('GET', '/api/v1/health');
    expect(response.headers).toMatchObject({
      'x-content-type-options': 'nosniff',
      'x-frame-options': 'DENY',
      'cache-control': 'no-store',
    });
    expect(response.headers['x-request-id']).toBeTruthy();
  });

  it('returns a JSON 404 for unknown routes', async () => {
    const response = await api.request('GET', '/api/v1/nope');
    expect(response.status).toBe(404);
    expect(response.body.error.code).toBe('ROUTE_NOT_FOUND');
  });

  it('serves API Gateway HTTP API (v2) events — the same handler runs on AWS Lambda', async () => {
    const response = await api.invoke({
      version: '2.0',
      routeKey: '$default',
      rawPath: '/api/v1/auth/login',
      rawQueryString: '',
      headers: { 'content-type': 'application/json' },
      requestContext: { http: { method: 'POST', path: '/api/v1/auth/login' } },
      body: JSON.stringify({ email: 'victor@example.com', password: 'Password123!' }),
      isBase64Encoded: false,
    } as never);
    expect(response.status).toBe(200);
    expect(response.body.user.role).toBe('validator');
  });

  it('keeps the migrations in sync with the entity metadata (no schema drift)', async () => {
    const pending = await api.app.dataSource.driver.createSchemaBuilder().log();
    expect(pending.upQueries.map((query) => query.query)).toEqual([]);
  });
});

describe('authentication & authorization', () => {
  it('logs in and returns the profile', async () => {
    const me = await api.request('GET', '/api/v1/auth/me', { token: alice });
    expect(me.status).toBe(200);
    expect(me.body).toMatchObject({ email: 'alice@example.com', role: 'requester' });
    expect(me.body).not.toHaveProperty('password');
  });

  it('rejects bad credentials with a generic message', async () => {
    const response = await api.request('POST', '/api/v1/auth/login', {
      body: { email: 'alice@example.com', password: 'wrong' },
    });
    expect(response.status).toBe(401);
    expect(response.body.error.code).toBe('INVALID_CREDENTIALS');
  });

  it('records sign-ins and failed sign-ins as events in the audit trail', async () => {
    await api.request('POST', '/api/v1/auth/login', {
      body: { email: 'bob@example.com', password: 'wrong' },
    });
    await api.login(api.users.bob); // a successful sign-in also resets the failure counter

    const rows: { event_name: string; aggregate_id: string; payload: { email?: string } }[] =
      await api.app.dataSource.query(
        `SELECT event_name, aggregate_id, payload FROM audit_logs
          WHERE event_name LIKE 'user.%' AND aggregate_id = $1 ORDER BY occurred_at`,
        [api.users.bob.id],
      );
    expect(rows.map((row) => row.event_name).slice(-2)).toEqual([
      'user.login-failed',
      'user.logged-in',
    ]);
    expect(JSON.stringify(rows)).not.toContain('wrong');
  });

  it('validates the login payload', async () => {
    const response = await api.request('POST', '/api/v1/auth/login', { body: { email: 'nope' } });
    expect(response.status).toBe(422);
    expect(response.body.error.details.map((d: { field: string }) => d.field)).toEqual(
      expect.arrayContaining(['email', 'password']),
    );
  });

  it('requires a valid token on protected routes', async () => {
    expect((await api.request('GET', BASE)).status).toBe(401);
    expect((await api.request('GET', BASE, { token: 'garbage' })).status).toBe(401);
  });

  it('enforces role-based access control declared in root.yaml', async () => {
    expect((await api.request('GET', BASE, { token: alice })).body.error.code).toBe(
      'INSUFFICIENT_ROLE',
    );
    expect((await api.request('GET', '/api/v1/users', { token: alice })).status).toBe(403);
    expect((await submit(victor, '2030-02-01', '2030-02-03')).status).toBe(403);
    expect(
      (await api.request('GET', '/api/v1/me/vacation-requests', { token: victor })).status,
    ).toBe(403);
  });

  it('authenticates before validating input (no schema leak to anonymous callers)', async () => {
    const response = await api.request('POST', BASE, { body: { nonsense: true } });
    expect(response.status).toBe(401);
  });
});

describe('requester interface', () => {
  it('submits a request (201 + Location) and lists it', async () => {
    const created = await submit(alice, '2030-02-01', '2030-02-05', 'Ski trip');
    expect(created.status).toBe(201);
    expect(created.headers.location).toBe(`${BASE}/${created.body.id}`);
    expect(created.body).toMatchObject({
      status: 'pending',
      days: 5,
      reason: 'Ski trip',
      requester: { email: 'alice@example.com' },
    });

    const mine = await api.request('GET', '/api/v1/me/vacation-requests', { token: alice });
    expect(mine.body.data.map((r: { id: string }) => r.id)).toEqual([created.body.id]);
    expect(mine.body.meta).toEqual({ page: 1, pageSize: 10, totalItems: 1, totalPages: 1 });

    const stats = await api.request('GET', '/api/v1/me/vacation-requests/stats', { token: alice });
    expect(stats.body).toEqual({ pending: 1, approved: 0, rejected: 0, total: 1 });
  });

  it('only lists the caller’s own requests', async () => {
    await submit(alice, '2030-02-01', '2030-02-05');
    await submit(bob, '2030-02-01', '2030-02-05');
    const mine = await api.request('GET', '/api/v1/me/vacation-requests', { token: bob });
    expect(mine.body.data).toHaveLength(1);
    expect(mine.body.data[0].requester.email).toBe('bob@example.com');
  });

  it('hides other people’s requests (404)', async () => {
    const created = await submit(alice, '2030-02-01', '2030-02-05');
    expect((await api.request('GET', `${BASE}/${created.body.id}`, { token: bob })).status).toBe(
      404,
    );
    expect((await api.request('GET', `${BASE}/${created.body.id}`, { token: alice })).status).toBe(
      200,
    );
  });

  it('validates the payload format', async () => {
    const response = await submit(alice, '2030-02-31', 'tomorrow');
    expect(response.status).toBe(422);
    expect(response.body.error.code).toBe('VALIDATION_ERROR');
    expect(response.body.error.details).toHaveLength(2);
  });

  it('edits a pending request and cancels it', async () => {
    const created = await submit(alice, '2030-02-01', '2030-02-05');
    const updated = await api.request('PUT', `${BASE}/${created.body.id}`, {
      token: alice,
      body: { startDate: '2030-02-02', endDate: '2030-02-04', reason: 'Shorter' },
    });
    expect(updated.status).toBe(200);
    expect(updated.body).toMatchObject({ startDate: '2030-02-02', endDate: '2030-02-04', days: 3 });

    const cancelled = await api.request('DELETE', `${BASE}/${created.body.id}`, { token: alice });
    expect(cancelled.status).toBe(204);
    expect((await api.request('GET', `${BASE}/${created.body.id}`, { token: alice })).status).toBe(
      404,
    );
  });

  it('re-submits a rejected request when it is edited', async () => {
    const created = await submit(alice, '2030-02-01', '2030-02-05');
    await api.request('POST', `${BASE}/${created.body.id}/reject`, {
      token: victor,
      body: { comment: 'Busy' },
    });

    const updated = await api.request('PUT', `${BASE}/${created.body.id}`, {
      token: alice,
      body: { startDate: '2030-03-01', endDate: '2030-03-03' },
    });
    expect(updated.body).toMatchObject({ status: 'pending', comments: null, decidedBy: null });
  });
});

describe('business rules', () => {
  it('#1 end date must be after start date', async () => {
    const response = await submit(alice, '2030-02-05', '2030-02-05');
    expect(response.status).toBe(422);
    expect(response.body.error.code).toBe('END_DATE_NOT_AFTER_START_DATE');
  });

  it('#2 requests cannot overlap for the same user (but may across users / rejected ones)', async () => {
    await submit(alice, '2030-02-01', '2030-02-05');
    const overlapping = await submit(alice, '2030-02-05', '2030-02-08');
    expect(overlapping.status).toBe(409);
    expect(overlapping.body.error.code).toBe('VACATION_OVERLAP');
    expect(overlapping.body.error.details[0]).toMatchObject({
      startDate: '2030-02-01',
      status: 'pending',
    });

    expect((await submit(bob, '2030-02-01', '2030-02-05')).status).toBe(201);
  });

  it('#2 holds under concurrency — the database exclusion constraint wins the race', async () => {
    const responses = await Promise.all(
      Array.from({ length: 6 }, (_, i) => submit(alice, `2030-04-0${i + 1}`, '2030-04-09')),
    );
    const statuses = responses.map((response) => response.status).sort();
    expect(statuses).toEqual([201, 409, 409, 409, 409, 409]);
    const stats = await api.request('GET', '/api/v1/me/vacation-requests/stats', { token: alice });
    expect(stats.body.total).toBe(1);
  });

  it('#3 approved requests cannot be modified or cancelled', async () => {
    const created = await submit(alice, '2030-02-01', '2030-02-05');
    await api.request('POST', `${BASE}/${created.body.id}/approve`, { token: victor });

    const update = await api.request('PUT', `${BASE}/${created.body.id}`, {
      token: alice,
      body: { startDate: '2030-02-02', endDate: '2030-02-05' },
    });
    expect(update.status).toBe(409);
    expect(update.body.error.code).toBe('REQUEST_NOT_MODIFIABLE');
    expect(
      (await api.request('DELETE', `${BASE}/${created.body.id}`, { token: alice })).status,
    ).toBe(409);
  });

  it('#4 requests in the past are not allowed (today is allowed)', async () => {
    const past = await submit(alice, '2030-01-14', '2030-01-16');
    expect(past.status).toBe(422);
    expect(past.body.error.code).toBe('START_DATE_IN_PAST');
    expect((await submit(alice, '2030-01-15', '2030-01-16')).status).toBe(201);
  });

  it('#5 a rejection must contain a comment', async () => {
    const created = await submit(alice, '2030-02-01', '2030-02-05');
    for (const body of [{}, { comment: '' }, { comment: '   ' }]) {
      const response = await api.request('POST', `${BASE}/${created.body.id}/reject`, {
        token: victor,
        body,
      });
      expect(response.status).toBe(422);
      expect(response.body.error.code).toBe('REJECTION_COMMENT_REQUIRED');
    }
    const rejected = await api.request('POST', `${BASE}/${created.body.id}/reject`, {
      token: victor,
      body: { comment: 'Release week' },
    });
    expect(rejected.status).toBe(200);
    expect(rejected.body).toMatchObject({
      status: 'rejected',
      comments: 'Release week',
      decidedBy: { email: 'victor@example.com' },
    });
  });

  it('#6 only validators can approve or reject', async () => {
    const created = await submit(alice, '2030-02-01', '2030-02-05');
    for (const action of ['approve', 'reject']) {
      const response = await api.request('POST', `${BASE}/${created.body.id}/${action}`, {
        token: bob,
        body: { comment: 'x' },
      });
      expect(response.status).toBe(403);
    }
    const approved = await api.request('POST', `${BASE}/${created.body.id}/approve`, {
      token: victor,
      body: { comment: 'Enjoy!' },
    });
    expect(approved.body).toMatchObject({ status: 'approved', comments: 'Enjoy!' });
  });

  it('a request can only be decided once, even by concurrent validators', async () => {
    const created = await submit(alice, '2030-02-01', '2030-02-05');
    const [approve, reject] = await Promise.all([
      api.request('POST', `${BASE}/${created.body.id}/approve`, { token: victor }),
      api.request('POST', `${BASE}/${created.body.id}/reject`, {
        token: victor,
        body: { comment: 'No' },
      }),
    ]);
    expect([approve.status, reject.status].sort()).toEqual([200, 409]);
  });
});

describe('validator interface', () => {
  beforeEach(async () => {
    const a1 = await submit(alice, '2030-02-01', '2030-02-05');
    await submit(alice, '2030-03-01', '2030-03-05');
    const b1 = await submit(bob, '2030-02-10', '2030-02-12');
    await api.request('POST', `${BASE}/${a1.body.id}/approve`, { token: victor });
    await api.request('POST', `${BASE}/${b1.body.id}/reject`, {
      token: victor,
      body: { comment: 'No' },
    });
  });

  it('lists all requests with pagination metadata', async () => {
    const page1 = await api.request('GET', BASE, { token: victor, query: { pageSize: 2 } });
    expect(page1.body.data).toHaveLength(2);
    expect(page1.body.meta).toEqual({ page: 1, pageSize: 2, totalItems: 3, totalPages: 2 });

    const page2 = await api.request('GET', BASE, {
      token: victor,
      query: { pageSize: 2, page: 2 },
    });
    expect(page2.body.data).toHaveLength(1);
    const ids = [...page1.body.data, ...page2.body.data].map((r: { id: string }) => r.id);
    expect(new Set(ids).size).toBe(3);
  });

  it('filters by status and by user', async () => {
    const pending = await api.request('GET', BASE, { token: victor, query: { status: 'pending' } });
    expect(pending.body.data.map((r: { status: string }) => r.status)).toEqual(['pending']);

    const bobs = await api.request('GET', BASE, {
      token: victor,
      query: { userId: api.users.bob.id },
    });
    expect(bobs.body.data).toHaveLength(1);
    expect(bobs.body.data[0]).toMatchObject({
      status: 'rejected',
      requester: { name: 'Bob Requester' },
    });

    const combined = await api.request('GET', BASE, {
      token: victor,
      query: { userId: api.users.alice.id, status: 'approved' },
    });
    expect(combined.body.meta.totalItems).toBe(1);
  });

  it('sorts by start date', async () => {
    const response = await api.request('GET', BASE, {
      token: victor,
      query: { sort: 'startDate', order: 'asc' },
    });
    expect(response.body.data.map((r: { startDate: string }) => r.startDate)).toEqual([
      '2030-02-01',
      '2030-02-10',
      '2030-03-01',
    ]);
  });

  it('rejects invalid filters', async () => {
    const response = await api.request('GET', BASE, {
      token: victor,
      query: { status: 'maybe', pageSize: 1000, userId: 'x' },
    });
    expect(response.status).toBe(422);
    expect(response.body.error.details).toHaveLength(3);
  });

  it('returns global stats and the user list for filters', async () => {
    const stats = await api.request('GET', `${BASE}/stats`, { token: victor });
    expect(stats.body).toEqual({ pending: 1, approved: 1, rejected: 1, total: 3 });

    const users = await api.request('GET', '/api/v1/users', {
      token: victor,
      query: { role: 'requester' },
    });
    expect(users.body.data.map((u: { name: string }) => u.name)).toEqual([
      'Alice Requester',
      'Bob Requester',
    ]);
  });

  it('records every domain event in the audit trail', async () => {
    const rows: { event_name: string }[] = await api.app.dataSource.query(
      `SELECT event_name FROM audit_logs WHERE event_name LIKE 'vacation-request.%' ORDER BY occurred_at`,
    );
    expect(rows.map((row) => row.event_name)).toEqual([
      'vacation-request.submitted',
      'vacation-request.submitted',
      'vacation-request.submitted',
      'vacation-request.approved',
      'vacation-request.rejected',
    ]);
  });
});

describe('team planning', () => {
  it('shows pending and approved vacations of the team to both roles, without private details', async () => {
    const a = await submit(alice, '2030-02-01', '2030-02-05', 'Private reason');
    const b = await submit(bob, '2030-02-04', '2030-02-08');
    await submit(bob, '2030-05-01', '2030-05-03'); // outside the window
    await api.request('POST', `${BASE}/${a.body.id}/approve`, { token: victor });

    for (const token of [alice, victor]) {
      const response = await api.request('GET', '/api/v1/team-calendar', {
        token,
        query: { from: '2030-02-01', to: '2030-02-28' },
      });
      expect(response.status).toBe(200);
      expect(response.body.members.map((m: { name: string }) => m.name)).toEqual([
        'Alice Requester',
        'Bob Requester',
      ]);
      expect(response.body.entries).toEqual([
        {
          id: a.body.id,
          userId: api.users.alice.id,
          startDate: '2030-02-01',
          endDate: '2030-02-05',
          status: 'approved',
        },
        {
          id: b.body.id,
          userId: api.users.bob.id,
          startDate: '2030-02-04',
          endDate: '2030-02-08',
          status: 'pending',
        },
      ]);
    }
  });

  it('excludes rejected requests and validates the window', async () => {
    const a = await submit(alice, '2030-02-01', '2030-02-05');
    await api.request('POST', `${BASE}/${a.body.id}/reject`, {
      token: victor,
      body: { comment: 'No' },
    });
    const response = await api.request('GET', '/api/v1/team-calendar', {
      token: alice,
      query: { from: '2030-02-01', to: '2030-02-28' },
    });
    expect(response.body.entries).toEqual([]);

    const tooWide = await api.request('GET', '/api/v1/team-calendar', {
      token: alice,
      query: { from: '2030-01-01', to: '2030-12-31' },
    });
    expect(tooWide.status).toBe(422);
  });
});

describe('brute-force protection', () => {
  it('locks an account after repeated failed logins (429 + Retry-After)', async () => {
    for (let i = 0; i < 3; i++) {
      await api.request('POST', '/api/v1/auth/login', {
        body: { email: 'bob@example.com', password: 'x' },
      });
    }
    const locked = await api.request('POST', '/api/v1/auth/login', {
      body: { email: 'bob@example.com', password: 'Password123!' },
    });
    expect(locked.status).toBe(429);
    expect(locked.body.error.code).toBe('LOGIN_LOCKED');
    expect(Number(locked.headers['retry-after'])).toBeGreaterThan(0);
  });
});
