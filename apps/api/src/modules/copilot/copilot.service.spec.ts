import { describe, expect, it, vi } from 'vitest';

import { ServiceUnavailableError, ValidationError } from '../../core/errors.js';
import type { CopilotGateway } from '../../integrations/openai/copilot.gateway.js';
import type { ZapService } from '../zaps/zap.service.js';
import { CopilotService } from './copilot.service.js';

const request = { prompt: 'Thank people when they open a PR', repositoryId: 100 };
const generated = {
  name: 'Welcome contributors',
  comment: 'Thanks @{{pull_request.author}} for opening {{pull_request.title}}!',
};

function setup(copilot: CopilotGateway | undefined = { draftZap: vi.fn().mockResolvedValue(generated) }) {
  const zaps = { create: vi.fn().mockResolvedValue({ id: 'zap-1', enabled: false }) };
  return { zaps, service: new CopilotService(copilot, zaps as unknown as ZapService) };
}

describe('CopilotService', () => {
  it('creates a disabled Zap through the existing Zap service', async () => {
    const { service, zaps } = setup();

    await service.createDraft('user-1', request);

    expect(zaps.create).toHaveBeenCalledWith('user-1', {
      name: generated.name,
      enabled: false,
      trigger: { key: 'github.pull_request.opened', config: { repositoryId: 100 } },
      action: { key: 'github.pull_request.comment', input: { body: generated.comment } },
    });
  });

  it('is unavailable when no OpenAI API key configured a gateway', async () => {
    const zaps = { create: vi.fn() };
    const service = new CopilotService(undefined, zaps as unknown as ZapService);

    await expect(service.createDraft('user-1', request)).rejects.toBeInstanceOf(ServiceUnavailableError);
  });

  it('rejects model output with unsupported template variables before creating a Zap', async () => {
    const { service, zaps } = setup({
      draftZap: vi.fn().mockResolvedValue({ ...generated, comment: 'Token: {{secrets.openai_key}}' }),
    });

    await expect(service.createDraft('user-1', request)).rejects.toBeInstanceOf(ValidationError);
    expect(zaps.create).not.toHaveBeenCalled();
  });

  it('passes provider failures through without creating a Zap', async () => {
    const failure = new Error('rate limited');
    const { service, zaps } = setup({ draftZap: vi.fn().mockRejectedValue(failure) });

    await expect(service.createDraft('user-1', request)).rejects.toBe(failure);
    expect(zaps.create).not.toHaveBeenCalled();
  });
});
