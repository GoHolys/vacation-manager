import { z } from 'zod';

const isValidTimeZone = (timeZone: string): boolean => {
  try {
    new Intl.DateTimeFormat('en-US', { timeZone });
    return true;
  } catch {
    return false;
  }
};

/**
 * Single source of truth for runtime configuration.
 * Every variable is validated at start-up so misconfiguration fails fast and loudly
 * instead of surfacing later as an obscure runtime error.
 */
const EnvSchema = z.object({
  NODE_ENV: z.enum(['development', 'test', 'production']).default('development'),
  PORT: z.coerce.number().int().min(1).max(65535).default(3000),
  LOG_LEVEL: z.enum(['fatal', 'error', 'warn', 'info', 'debug', 'trace', 'silent']).default('info'),
  FRONT_END_URL: z.url().default('http://localhost:5173'),
  APP_TIMEZONE: z.string().refine(isValidTimeZone, 'must be a valid IANA time zone').default('UTC'),

  DB_HOST: z.string().min(1).default('localhost'),
  DB_PORT: z.coerce.number().int().min(1).max(65535).default(5432),
  DB_USER: z.string().min(1).default('vacation'),
  DB_PASSWORD: z.string().default('vacation'),
  DB_NAME: z.string().min(1).default('vacation_manager'),
  DB_SSL: z.stringbool().default(false),
  DB_LOGGING: z.stringbool().default(false),

  JWT_SECRET: z.string().min(32, 'must be at least 32 characters long'),
  JWT_EXPIRES_IN: z
    .string()
    .regex(/^\d+[smhd]$/, 'must look like 15m, 8h or 7d')
    .default('8h'),
  JWT_ISSUER: z.string().default('vacation-manager-api'),
  JWT_AUDIENCE: z.string().default('vacation-manager-web'),
  BCRYPT_ROUNDS: z.coerce.number().int().min(4).max(15).default(12),
  LOGIN_MAX_ATTEMPTS: z.coerce.number().int().min(1).default(5),
  LOGIN_LOCKOUT_MINUTES: z.coerce.number().int().min(1).default(15),
  /** Set to true only behind a proxy you control (API Gateway, ALB, nginx) that sets X-Forwarded-For. */
  TRUST_PROXY: z.stringbool().default(false),
});

/** Values that must never reach production (they are published in .env.example / the README). */
const PLACEHOLDER_SECRET = /change-me|local-dev-secret|^(.)\1+$/i;

export type EnvVariables = z.infer<typeof EnvSchema>;

export interface AppConfig {
  env: EnvVariables['NODE_ENV'];
  port: number;
  logLevel: EnvVariables['LOG_LEVEL'];
  corsOrigin: string;
  timeZone: string;
  trustProxy: boolean;
  database: {
    host: string;
    port: number;
    username: string;
    password: string;
    database: string;
    ssl: boolean;
    logging: boolean;
  };
  auth: {
    jwtSecret: string;
    jwtExpiresIn: string;
    jwtIssuer: string;
    jwtAudience: string;
    bcryptRounds: number;
    loginMaxAttempts: number;
    loginLockoutMinutes: number;
  };
}

export class ConfigurationError extends Error {
  constructor(issues: string[]) {
    super(`Invalid environment configuration:\n  - ${issues.join('\n  - ')}`);
    this.name = 'ConfigurationError';
  }
}

export function loadConfig(source: NodeJS.ProcessEnv = process.env): AppConfig {
  const parsed = EnvSchema.safeParse(source);
  if (!parsed.success) {
    throw new ConfigurationError(
      parsed.error.issues.map((issue) => `${issue.path.join('.')}: ${issue.message}`),
    );
  }
  const env = parsed.data;
  if (env.NODE_ENV === 'production' && PLACEHOLDER_SECRET.test(env.JWT_SECRET)) {
    throw new ConfigurationError([
      'JWT_SECRET: a placeholder secret cannot be used in production — generate a random one',
    ]);
  }
  return {
    env: env.NODE_ENV,
    port: env.PORT,
    logLevel: env.LOG_LEVEL,
    corsOrigin: env.FRONT_END_URL,
    timeZone: env.APP_TIMEZONE,
    trustProxy: env.TRUST_PROXY,
    database: {
      host: env.DB_HOST,
      port: env.DB_PORT,
      username: env.DB_USER,
      password: env.DB_PASSWORD,
      database: env.DB_NAME,
      ssl: env.DB_SSL,
      logging: env.DB_LOGGING,
    },
    auth: {
      jwtSecret: env.JWT_SECRET,
      jwtExpiresIn: env.JWT_EXPIRES_IN,
      jwtIssuer: env.JWT_ISSUER,
      jwtAudience: env.JWT_AUDIENCE,
      bcryptRounds: env.BCRYPT_ROUNDS,
      loginMaxAttempts: env.LOGIN_MAX_ATTEMPTS,
      loginLockoutMinutes: env.LOGIN_LOCKOUT_MINUTES,
    },
  };
}

let cachedConfig: AppConfig | undefined;

/** Lazily loads (and memoises) the configuration — call only after `.env` has been loaded. */
export function getConfig(): AppConfig {
  cachedConfig ??= loadConfig();
  return cachedConfig;
}
