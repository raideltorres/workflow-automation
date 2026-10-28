import { pino, type Logger } from 'pino';

export type { Logger };

export function createLogger(env: string): Logger {
  return pino({
    level: env === 'test' ? 'silent' : 'info',
    redact: {
      paths: ['req.headers.cookie', 'req.headers.authorization', '*.token', '*.accessToken'],
      censor: '[redacted]',
    },
    ...(env === 'development' ? { transport: { target: 'pino-pretty', options: { colorize: true } } } : {}),
  });
}
