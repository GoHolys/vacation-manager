import pino from 'pino';

export type Logger = pino.Logger;

export interface LoggerOptions {
  level: pino.LevelWithSilent;
  pretty: boolean;
}

const canPrettyPrint = (): boolean => {
  try {
    require.resolve('pino-pretty');
    return true;
  } catch {
    return false;
  }
};

export function createLogger({ level, pretty }: LoggerOptions): Logger {
  return pino({
    level,
    base: { service: 'vacation-manager-api' },
    // Never leak credentials into logs.
    redact: {
      paths: ['password', '*.password', 'headers.authorization', 'accessToken', '*.accessToken'],
      censor: '[REDACTED]',
    },
    ...(pretty && canPrettyPrint()
      ? {
          transport: {
            target: 'pino-pretty',
            options: { colorize: true, translateTime: 'HH:MM:ss.l', ignore: 'pid,hostname,service' },
          },
        }
      : {}),
  });
}
