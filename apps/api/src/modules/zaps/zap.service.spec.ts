import { beforeEach, describe, expect, it, vi } from 'vitest';

import { ForbiddenError, NotFoundError, ValidationError } from '../../core/errors.js';
import { buildRepository, buildZap, buildZapInput } from '../../testing/factories.js';
import type { GitHubAccessService } from '../github/github-access.service.js';
import type { ZapRunRepository } from '../runs/zap-run.repository.js';
import type { ZapRepository } from './zap.repository.js';
import { ZapService } from './zap.service.js';

const input = buildZapInput({ enabled: false, action: { key: 'github.pull_request.comment', input: { body: 'Thanks!' } } });

function setup() {
  const zaps = {
    create: vi.fn().mockImplementation(async (ownerId: string) => buildZap({ ownerId })),
    listByOwner: vi.fn().mockResolvedValue([buildZap(), buildZap({ id: 'zap-2' })]),
    findOwned: vi.fn().mockResolvedValue(buildZap()),
    updateOwned: vi.fn().mockImplementation(async () => buildZap({ enabled: true })),
    deleteOwned: vi.fn().mockResolvedValue(true),
  };
  const runs = { listByZap: vi.fn().mockResolvedValue([]) };
  const access = { requireRepositoryAccess: vi.fn().mockResolvedValue(buildRepository()) };
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

  it('lists only the caller zaps and never exposes the owner id', async () => {
    const zaps = await ctx.service.list('user-1');

    expect(ctx.zaps.listByOwner).toHaveBeenCalledWith('user-1');
    expect(zaps.map((z) => z.id)).toEqual(['zap-1', 'zap-2']);
    for (const zap of zaps) expect(zap).not.toHaveProperty('ownerId');
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

  it("returns not found for another user's zap on every operation", async () => {
    ctx.zaps.findOwned.mockResolvedValue(null);
    ctx.zaps.deleteOwned.mockResolvedValue(false);

    await expect(ctx.service.get('intruder', 'zap-1')).rejects.toBeInstanceOf(NotFoundError);
    await expect(ctx.service.update('intruder', 'zap-1', { enabled: true })).rejects.toBeInstanceOf(NotFoundError);
    await expect(ctx.service.delete('intruder', 'zap-1')).rejects.toBeInstanceOf(NotFoundError);
    expect(ctx.zaps.findOwned).toHaveBeenCalledWith('zap-1', 'intruder');
    expect(ctx.zaps.deleteOwned).toHaveBeenCalledWith('zap-1', 'intruder');
    expect(ctx.zaps.updateOwned).not.toHaveBeenCalled();
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

  it('disables a zap without touching its other fields', async () => {
    await ctx.service.update('user-1', 'zap-1', { enabled: false });

    expect(ctx.zaps.updateOwned).toHaveBeenCalledWith('zap-1', 'user-1', {
      name: 'Thank contributors',
      enabled: false,
      trigger: { key: 'github.pull_request.opened', config: { repositoryId: 100 } },
      action: { key: 'github.pull_request.comment', input: { body: 'Thanks @{{pull_request.author}}!' } },
      repositoryFullName: 'acme/app',
    });
  });

  it('moving a zap to another repository requires access to the new repository', async () => {
    ctx.access.requireRepositoryAccess.mockRejectedValue(new ForbiddenError());
    const patch = { trigger: { key: 'github.pull_request.opened' as const, config: { repositoryId: 999 } } };

    await expect(ctx.service.update('user-1', 'zap-1', patch)).rejects.toBeInstanceOf(ForbiddenError);
    expect(ctx.access.requireRepositoryAccess).toHaveBeenCalledWith('user-1', 999);
    expect(ctx.zaps.updateOwned).not.toHaveBeenCalled();
  });

  it('rejects an update whose template references fields the trigger does not expose', async () => {
    const patch = { action: { key: 'github.pull_request.comment' as const, input: { body: '{{secret.token}}' } } };

    const error = await ctx.service.update('user-1', 'zap-1', patch).catch((e: unknown) => e);

    expect(error).toBeInstanceOf(ValidationError);
    expect((error as ValidationError).details).toEqual([
      { path: 'action.input.body', message: 'Unknown fields: secret.token' },
    ]);
    expect(ctx.zaps.updateOwned).not.toHaveBeenCalled();
  });

  it('treats a zap deleted between read and write as not found', async () => {
    ctx.zaps.updateOwned.mockResolvedValue(null);

    await expect(ctx.service.update('user-1', 'zap-1', { name: 'New' })).rejects.toBeInstanceOf(NotFoundError);
  });

  it('deletes an owned zap', async () => {
    await expect(ctx.service.delete('user-1', 'zap-1')).resolves.toBeUndefined();
  });

  it('only lists runs for zaps the user owns', async () => {
    ctx.zaps.findOwned.mockResolvedValue(null);

    await expect(ctx.service.listRuns('intruder', 'zap-1')).rejects.toBeInstanceOf(NotFoundError);
    expect(ctx.runs.listByZap).not.toHaveBeenCalled();
  });

  it('lists runs by the owned zap id', async () => {
    await ctx.service.listRuns('user-1', 'zap-1');

    expect(ctx.runs.listByZap).toHaveBeenCalledWith('zap-1');
  });
});
