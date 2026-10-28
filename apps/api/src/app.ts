import express, { type Express } from 'express';
import session from 'express-session';
import { pinoHttp } from 'pino-http';

import type { Container } from './container.js';
import { createErrorHandler, notFoundHandler } from './core/middleware/error-handler.js';

const SESSION_MAX_AGE_MS = 7 * 24 * 60 * 60 * 1000;

export function createApp(container: Container): Express {
  const { config, logger, sessionStore } = container;
  const app = express();

  app.disable('x-powered-by');
  app.set('trust proxy', 1);
  app.use(pinoHttp({ logger, autoLogging: { ignore: (req) => req.url === '/api/health' } }));

  app.get('/api/health', (_req, res) => {
    res.json({ status: 'ok' });
  });

  app.use(express.json({ limit: '100kb' }));
  app.use(
    session({
      name: 'wa.sid',
      secret: config.sessionSecret,
      store: sessionStore,
      resave: false,
      saveUninitialized: false,
      cookie: {
        httpOnly: true,
        sameSite: 'lax',
        secure: config.env === 'production',
        maxAge: SESSION_MAX_AGE_MS,
      },
    }),
  );

  app.use(notFoundHandler);
  app.use(createErrorHandler(logger));

  return app;
}
