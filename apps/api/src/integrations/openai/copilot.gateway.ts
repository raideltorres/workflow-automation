import type { CopilotZapDraft } from '@workflow/shared';

export interface CopilotGateway {
  draftZap(prompt: string): Promise<CopilotZapDraft>;
}
