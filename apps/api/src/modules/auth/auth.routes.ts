import { Router } from 'express';

import type { AuthController } from './auth.controller.js';

export function createAuthRouter(controller: AuthController): Router {
  const router = Router();
  router.get('/github/login', controller.login);
  router.get('/github/callback', controller.callback);
  router.get('/me', controller.me);
  router.post('/logout', controller.logout);
  return router;
}
