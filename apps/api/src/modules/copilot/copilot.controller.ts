import type { Request, Response } from 'express';

import type { CopilotZapDraftRequest } from '@workflow/shared';

import { currentUserId } from '../../core/middleware/require-auth.js';
import type { CopilotService } from './copilot.service.js';

export class CopilotController {
  constructor(private readonly copilot: CopilotService) {}

  createDraft = async (
    req: Request<Record<string, string>, unknown, CopilotZapDraftRequest>,
    res: Response,
  ): Promise<void> => {
    const zap = await this.copilot.createDraft(currentUserId(req), req.body);
    res.status(201).json(zap);
  };
}
