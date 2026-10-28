import express, { type Express } from 'express';
import session from 'express-session';
import { pinoHttp } from 'pino-http';

import type { Container } from './container.js';
import { createErrorHandler, notFoundHandler } from './core/middleware/error-handler.js';
import { createAuthRouter } from './modules/auth/auth.routes.js';
import { createGitHubRouter } from './modules/github/github.routes.js';
import { createWebhookRouter } from './modules/webhooks/webhook.routes.js';
import { createZapRouter } from './modules/zaps/zap.routes.js';

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

  app.use('/api/webhooks', createWebhookRouter(container.webhookController));

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

  app.use('/api/auth', createAuthRouter(container.authController));
  app.use('/api/github', createGitHubRouter(container.githubAccess, container.githubGateway.installUrl));
  app.use('/api/zaps', createZapRouter(container.zapController));

  app.use(notFoundHandler);
  app.use(createErrorHandler(logger));

  return app;
}
