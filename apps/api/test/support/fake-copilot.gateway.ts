import type { CopilotZapDraft } from '@workflow/shared';

import type { CopilotGateway } from '../../src/integrations/openai/copilot.gateway.js';

const DEFAULT_DRAFT: CopilotZapDraft = {
  name: 'Welcome contributors',
  comment: 'Thanks @{{pull_request.author}} for opening "{{pull_request.title}}"!',
};

export class FakeCopilotGateway implements CopilotGateway {
  private draft: CopilotZapDraft = DEFAULT_DRAFT;
  private failure: Error | null = null;

  setDraft(draft: CopilotZapDraft): void {
    this.draft = draft;
  }

  failWith(error: Error | null): void {
    this.failure = error;
  }

  reset(): void {
    this.draft = DEFAULT_DRAFT;
    this.failure = null;
  }

  async draftZap(_prompt: string): Promise<CopilotZapDraft> {
    if (this.failure) throw this.failure;
    return this.draft;
  }
}
