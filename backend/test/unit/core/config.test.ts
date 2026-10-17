import { describe, expect, it } from 'vitest';
import { ConfigurationError, loadConfig } from '../../../src/config/env';

const base = { JWT_SECRET: 'x7Kq9mZ2vB4nR8tY1wE5uI3oP6aS0dF2gH4jK' };

describe('loadConfig', () => {
  it('applies defaults and parses booleans', () => {
    const config = loadConfig({ ...base, DB_SSL: 'true', TRUST_PROXY: 'false' });
    expect(config).toMatchObject({ env: 'development', port: 3000, trustProxy: false });
    expect(config.database.ssl).toBe(true);
  });

  it('lists every invalid variable at once', () => {
    let message = '';
    try {
      loadConfig({ JWT_SECRET: 'short', PORT: 'abc', APP_TIMEZONE: 'Mars/Base' });
    } catch (error) {
      message = (error as Error).message;
    }
    for (const variable of ['JWT_SECRET', 'PORT', 'APP_TIMEZONE'])
      expect(message).toContain(variable);
  });

  it('refuses the published placeholder secret in production', () => {
    expect(() =>
      loadConfig({
        NODE_ENV: 'production',
        JWT_SECRET: 'change-me-to-a-long-random-secret-of-at-least-32-chars',
      }),
    ).toThrow(ConfigurationError);
    expect(() => loadConfig({ ...base, NODE_ENV: 'production' })).not.toThrow();
  });
});
