import path from 'node:path';
import type { CommonEvent } from 'commoneventframework/dist/types/commonEvent';
import { describe, expect, it } from 'vitest';
import { z } from 'zod';
import { defineInputParser } from '../../../src/http/input-parser';
import { RouteSecurity } from '../../../src/http/route-security';

const event = (overrides: Partial<CommonEvent> = {}): CommonEvent => ({
  path: '/x',
  method: 'POST',
  body: null,
  pathParameters: {},
  queryStringParameters: {},
  headers: { 'content-type': 'application/json' },
  version: 'commonEvent',
  ...overrides,
});

describe('defineInputParser', () => {
  const parser = defineInputParser({
    params: z.object({ id: z.uuid() }),
    query: z.object({ page: z.coerce.number().int().min(1).default(1), q: z.string().optional() }),
    body: z.object({ name: z.string().min(1) }),
  });

  it('returns typed, coerced input', () => {
    const input = parser(
      event({
        pathParameters: { id: '3f1c2b9e-1111-4222-8333-123456789abc' },
        queryStringParameters: { page: '2', q: 'hello%20world' },
        body: JSON.stringify({ name: 'Ada' }),
      }),
    );
    expect(input).toEqual({
      params: { id: '3f1c2b9e-1111-4222-8333-123456789abc' },
      query: { page: 2, q: 'hello world' },
      body: { name: 'Ada' },
    });
  });

  it('reports every invalid field at once with its location', () => {
    expect(() =>
      parser(
        event({ pathParameters: { id: 'nope' }, queryStringParameters: { page: '0' }, body: '{}' }),
      ),
    ).toThrow(
      expect.objectContaining({
        code: 'VALIDATION_ERROR',
        details: expect.arrayContaining([
          expect.objectContaining({ field: 'id', location: 'params' }),
          expect.objectContaining({ field: 'page', location: 'query' }),
          expect.objectContaining({ field: 'name', location: 'body' }),
        ]),
      }),
    );
  });

  it('rejects malformed JSON, wrong content types and oversized bodies', () => {
    const valid = { pathParameters: { id: '3f1c2b9e-1111-4222-8333-123456789abc' } };
    expect(() => parser(event({ ...valid, body: '{oops' }))).toThrow(
      expect.objectContaining({ status: 400 }),
    );
    expect(() =>
      parser(event({ ...valid, body: 'name=x', headers: { 'content-type': 'text/plain' } })),
    ).toThrow(expect.objectContaining({ status: 415 }));
    expect(() =>
      parser(event({ ...valid, body: JSON.stringify({ name: 'x'.repeat(70_000) }) })),
    ).toThrow(expect.objectContaining({ status: 413 }));
  });
});

describe('RouteSecurity', () => {
  const route = (method: string, routePath: string, handler = 'handlers/x#y') => ({
    method,
    path: routePath,
    handler,
  });

  it('reads public routes and roles from the OpenAPI document', () => {
    const security = RouteSecurity.fromDocument({
      security: [{ bearerAuth: [] }],
      paths: {
        '/public': { get: { 'x-handler': 'h#public', security: [] } },
        '/admin': { post: { 'x-handler': 'h#admin', 'x-roles': ['validator'] } },
      },
    });
    expect(security.policyFor(route('GET', '/public'))).toMatchObject({ isPublic: true });
    expect(security.policyFor(route('POST', '/admin'))).toMatchObject({
      isPublic: false,
      roles: ['validator'],
    });
  });

  it('fails closed for unknown routes and allows framework built-ins', () => {
    const security = RouteSecurity.fromDocument({ paths: {} });
    expect(security.policyFor(route('GET', '/unknown'))).toMatchObject({
      isPublic: false,
      roles: [],
    });
    expect(security.policyFor(route('GET', '/doc', '__builtin__/doc'))).toMatchObject({
      builtin: true,
    });
  });

  it('refuses to start when a protected route declares no roles or unknown roles', () => {
    expect(() =>
      RouteSecurity.fromDocument({
        security: [{ bearerAuth: [] }],
        paths: { '/oops': { get: { 'x-handler': 'h#oops' } } },
      }),
    ).toThrow(/declares no x-roles/);
    expect(() =>
      RouteSecurity.fromDocument({
        paths: { '/oops': { get: { 'x-handler': 'h#oops', 'x-roles': ['admin'] } } },
      }),
    ).toThrow(/valid roles/);
  });

  it('accepts the real root.yaml (every route is secured or explicitly public)', () => {
    const security = RouteSecurity.fromOpenApiFile(
      path.resolve(__dirname, '../../../src/root.yaml'),
    );
    expect(security.policyFor(route('POST', '/api/v1/auth/login'))).toMatchObject({
      isPublic: true,
    });
    expect(
      security.policyFor(route('POST', '/api/v1/vacation-requests/:id/approve')),
    ).toMatchObject({
      isPublic: false,
      roles: ['validator'],
    });
    expect(security.policyFor(route('POST', '/api/v1/vacation-requests'))).toMatchObject({
      roles: ['requester'],
    });
  });
});
