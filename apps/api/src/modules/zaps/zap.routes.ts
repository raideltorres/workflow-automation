import { Router } from 'express';

import { ZapInputSchema, ZapPatchSchema } from '@workflow/shared';

import { requireAuth } from '../../core/middleware/require-auth.js';
import { validateBody } from '../../core/middleware/validate.js';
import type { ZapController } from './zap.controller.js';

export function createZapRouter(controller: ZapController): Router {
  const router = Router();
  router.use(requireAuth);

  router.get('/', controller.list);
  router.post('/', validateBody(ZapInputSchema), controller.create);
  router.get('/:id', controller.get);
  router.patch('/:id', validateBody(ZapPatchSchema), controller.update);
  router.delete('/:id', controller.remove);
  router.get('/:id/runs', controller.runs);

  return router;
}
