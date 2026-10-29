import {
  type CopilotZapDraftRequest,
  ZapInputSchema,
  type Zap,
} from '@workflow/shared';

import { ServiceUnavailableError, ValidationError } from '../../core/errors.js';
import type { CopilotGateway } from '../../integrations/openai/copilot.gateway.js';
import type { ZapService } from '../zaps/zap.service.js';

export class CopilotService {
  constructor(
    private readonly copilot: CopilotGateway | undefined,
    private readonly zaps: ZapService,
  ) {}

  async createDraft(ownerId: string, request: CopilotZapDraftRequest): Promise<Zap> {
    if (!this.copilot) throw new ServiceUnavailableError('Copilot');

    const draft = await this.copilot.draftZap(request.prompt);
    const input = ZapInputSchema.safeParse({
      name: draft.name,
      enabled: false,
      trigger: {
        key: 'github.pull_request.opened',
        config: { repositoryId: request.repositoryId },
      },
      action: {
        key: 'github.pull_request.comment',
        input: { body: draft.comment },
      },
    });
    if (!input.success) {
      throw new ValidationError(
        'Copilot produced an invalid Zap draft',
        input.error.issues.map((issue) => ({ path: issue.path.join('.'), message: issue.message })),
      );
    }

    return this.zaps.create(ownerId, input.data);
  }
}
