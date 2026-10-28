import { beforeEach, describe, expect, it, vi } from 'vitest';

import type { ZapInput } from '@workflow/shared';

import { ForbiddenError, NotFoundError, ValidationError } from '../../core/errors.js';
import { buildZap } from '../../testing/factories.js';
import type { GitHubAccessService } from '../github/github-access.service.js';
import type { ZapRunRepository } from '../runs/zap-run.repository.js';
import type { ZapRepository } from './zap.repository.js';
import { ZapService } from './zap.service.js';

const input: ZapInput = {
  name: 'Thank contributors',
  enabled: false,
  trigger: { key: 'github.pull_request.opened', config: { repositoryId: 100 } },
  action: { key: 'github.pull_request.comment', input: { body: 'Thanks!' } },
};

const repository = { id: 100, fullName: 'acme/app', private: false, installationId: 7 };

function setup() {
  const zaps = {
    create: vi.fn().mockImplementation(async (ownerId: string) => buildZap({ ownerId })),
    findOwned: vi.fn().mockResolvedValue(buildZap()),
    updateOwned: vi.fn().mockImplementation(async () => buildZap({ enabled: true })),
    deleteOwned: vi.fn().mockResolvedValue(true),
  };
  const runs = { listByZap: vi.fn().mockResolvedValue([]) };
  const access = { requireRepositoryAccess: vi.fn().mockResolvedValue(repository) };
  const service = new ZapService(
    zaps as unknown as ZapRepository,
    runs as unknown as ZapRunRepository,
    access as unknown as GitHubAccessService,
  );
  return { zaps, runs, access, service };
}

describe('ZapService', () => {
  let ctx: ReturnType<typeof setup>;

  beforeEach(() => {
    ctx = setup();
  });

  it('creates a zap only after verifying repository access, storing the repo name', async () => {
    const zap = await ctx.service.create('user-1', input);

    expect(ctx.access.requireRepositoryAccess).toHaveBeenCalledWith('user-1', 100);
    expect(ctx.zaps.create).toHaveBeenCalledWith('user-1', { ...input, repositoryFullName: 'acme/app' });
    expect(zap).not.toHaveProperty('ownerId');
  });

  it('refuses to create a zap on a repository the user cannot access', async () => {
    ctx.access.requireRepositoryAccess.mockRejectedValue(new ForbiddenError());

    await expect(ctx.service.create('user-1', input)).rejects.toBeInstanceOf(ForbiddenError);
    expect(ctx.zaps.create).not.toHaveBeenCalled();
  });

  it("returns not found for another user's zap", async () => {
    ctx.zaps.findOwned.mockResolvedValue(null);

    await expect(ctx.service.get('intruder', 'zap-1')).rejects.toBeInstanceOf(NotFoundError);
    await expect(ctx.service.update('intruder', 'zap-1', { enabled: true })).rejects.toBeInstanceOf(NotFoundError);
    expect(ctx.zaps.findOwned).toHaveBeenCalledWith('zap-1', 'intruder');
  });

  it('merges a partial update with the stored zap and re-checks access', async () => {
    await ctx.service.update('user-1', 'zap-1', { enabled: true });

    expect(ctx.access.requireRepositoryAccess).toHaveBeenCalledWith('user-1', 100);
    expect(ctx.zaps.updateOwned).toHaveBeenCalledWith(
      'zap-1',
      'user-1',
      expect.objectContaining({ enabled: true, name: 'Thank contributors', repositoryFullName: 'acme/app' }),
    );
  });

  it('rejects an update whose template references fields the trigger does not expose', async () => {
    const patch = { action: { key: 'github.pull_request.comment' as const, input: { body: '{{secret.token}}' } } };

    await expect(ctx.service.update('user-1', 'zap-1', patch)).rejects.toBeInstanceOf(ValidationError);
    expect(ctx.zaps.updateOwned).not.toHaveBeenCalled();
  });

  it('only lists runs for zaps the user owns', async () => {
    ctx.zaps.findOwned.mockResolvedValue(null);

    await expect(ctx.service.listRuns('intruder', 'zap-1')).rejects.toBeInstanceOf(NotFoundError);
    expect(ctx.runs.listByZap).not.toHaveBeenCalled();
  });
});
