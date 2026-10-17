import 'reflect-metadata';
import bcrypt from 'bcryptjs';
import { type Context, loadEnv } from 'commoneventframework';
import type { CommonEvent, LambdaEvent } from 'commoneventframework/dist/types/commonEvent';
import pino from 'pino';
import {
  type Application,
  createApplication,
  setApplication,
} from '../../src/bootstrap/application';
import { loadConfig } from '../../src/config/env';
// The real Lambda entry point; it resolves the application lazily (see setApplication below).
import { handler } from '../../src/index';
import { FixedClock } from '../../src/core/clock';
import { UserRecord as User } from '../../src/modules/users/infrastructure/user.record';
import { UserRole } from '../../src/modules/users/domain/user-role';

/**
 * End-to-end harness: real PostgreSQL, real migrations, real Common Event Framework routing.
 * Requests are sent to the exported Lambda `handler` — exactly what API Gateway or the local
 * dev server call — so everything except the TCP socket is exercised.
 */

export const TODAY = '2030-01-15';
export const PASSWORD = 'Password123!';

export interface TestUsers {
  alice: User; // requester
  bob: User; // requester
  victor: User; // validator
}

export interface ApiResponse<T = any> {
  status: number;
  headers: Record<string, string>;
  body: T;
}

type Handler = (
  event: LambdaEvent,
  context: Context,
) => Promise<{
  statusCode?: number;
  headers?: Record<string, unknown>;
  body?: string;
}>;

const lambdaContext = {
  functionName: 'vacation-manager',
  invokedFunctionArn: 'arn:aws:lambda:eu-west-1:000000000000:function:vacation-manager',
  awsRequestId: 'e2e',
  getRemainingTimeInMillis: () => 30_000,
} as unknown as Context;

export class TestApi {
  private constructor(
    readonly app: Application,
    readonly users: TestUsers,
    private readonly handler: Handler,
  ) {}

  static async start(): Promise<TestApi> {
    await loadEnv();
    const database = process.env.DB_TEST_NAME ?? 'vacation_manager_test';
    if (!database.endsWith('_test')) {
      throw new Error(`Refusing to run e2e tests against "${database}" (name must end with _test)`);
    }
    const config = loadConfig({
      ...process.env,
      NODE_ENV: 'test',
      LOG_LEVEL: 'silent',
      DB_NAME: database,
      DB_LOGGING: 'false',
      JWT_SECRET: process.env.JWT_SECRET ?? 'e2e-secret-e2e-secret-e2e-secret-e2e',
      BCRYPT_ROUNDS: '4',
      LOGIN_MAX_ATTEMPTS: '3',
    });

    const app = await createApplication(config, {
      clock: new FixedClock(new Date(`${TODAY}T10:00:00Z`)),
      logger: pino({ level: 'silent' }),
    });
    await app.dataSource.dropDatabase();
    await app.dataSource.runMigrations();

    const passwordHash = await bcrypt.hash(PASSWORD, 4);
    const repository = app.dataSource.getRepository(User);
    const save = (name: string, email: string, role: UserRole) =>
      repository.save(repository.create({ name, email, role, password: passwordHash }));
    const users: TestUsers = {
      alice: await save('Alice Requester', 'alice@example.com', UserRole.REQUESTER),
      bob: await save('Bob Requester', 'bob@example.com', UserRole.REQUESTER),
      victor: await save('Victor Validator', 'victor@example.com', UserRole.VALIDATOR),
    };

    setApplication(app);
    return new TestApi(app, users, handler as Handler);
  }

  async stop(): Promise<void> {
    setApplication(undefined);
    await this.app.shutdown();
  }

  async resetRequests(): Promise<void> {
    await this.app.dataSource.query('TRUNCATE TABLE "audit_logs", "vacation_requests"');
  }

  /** Sends a raw Lambda event (any source supported by the Common Event Framework). */
  async invoke<T = any>(event: LambdaEvent): Promise<ApiResponse<T>> {
    const result = await this.handler(event, lambdaContext);
    const headers = Object.fromEntries(
      Object.entries(result.headers ?? {}).map(([key, value]) => [
        key.toLowerCase(),
        String(value),
      ]),
    );
    return {
      status: result.statusCode ?? 200,
      headers,
      body: (result.body ? safeJson(result.body) : undefined) as T,
    };
  }

  request<T = any>(
    method: string,
    path: string,
    options: { token?: string; body?: unknown; query?: Record<string, string | number> } = {},
  ): Promise<ApiResponse<T>> {
    const headers: Record<string, string> = { 'content-type': 'application/json' };
    if (options.token) headers.authorization = `Bearer ${options.token}`;
    const event: CommonEvent = {
      path,
      method,
      body: options.body === undefined ? null : JSON.stringify(options.body),
      pathParameters: {},
      queryStringParameters: Object.fromEntries(
        Object.entries(options.query ?? {}).map(([key, value]) => [key, String(value)]),
      ),
      headers,
      version: 'commonEvent',
    };
    return this.invoke<T>(event);
  }

  async login(user: User): Promise<string> {
    const response = await this.request('POST', '/api/v1/auth/login', {
      body: { email: user.email, password: PASSWORD },
    });
    if (response.status !== 200) throw new Error(`Login failed: ${JSON.stringify(response.body)}`);
    return response.body.accessToken as string;
  }
}

function safeJson(text: string): unknown {
  try {
    return JSON.parse(text);
  } catch {
    return text;
  }
}
