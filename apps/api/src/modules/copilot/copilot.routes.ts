import { Router } from 'express';

import { CopilotZapDraftRequestSchema } from '@workflow/shared';

import { requireAuth } from '../../core/middleware/require-auth.js';
import { validateBody } from '../../core/middleware/validate.js';
import type { CopilotController } from './copilot.controller.js';

export function createCopilotRouter(controller: CopilotController): Router {
  const router = Router();
  router.use(requireAuth);
  router.post('/zap-drafts', validateBody(CopilotZapDraftRequestSchema), controller.createDraft);
  return router;
}
