import { beforeEach, describe, expect, it, vi } from 'vitest';

import { createLogger } from '../../core/logger.js';
import { buildPullRequestOpenedPayload } from '../../testing/factories.js';
import { EngineRegistry } from '../engine/engine.registry.js';
import { pullRequestOpenedTrigger } from '../engine/triggers/pull-request-opened.trigger.js';
import type { ZapExecutor } from '../engine/zap-executor.service.js';
import type { GitHubAccessService } from '../github/github-access.service.js';
import { WebhookService } from './webhook.service.js';

const repo = { id: 100, full_name: 'acme/app', private: false };

function setup() {
  const executor = { handle: vi.fn().mockResolvedValue([]) };
  const access = {
    applyRepositoriesChange: vi.fn().mockResolvedValue(undefined),
    removeInstallation: vi.fn().mockResolvedValue(undefined),
  };
  const service = new WebhookService(
    new EngineRegistry([pullRequestOpenedTrigger], []),
    executor as unknown as ZapExecutor,
    access as unknown as GitHubAccessService,
    createLogger('test'),
  );
  return { executor, access, service };
}

describe('WebhookService', () => {
  let ctx: ReturnType<typeof setup>;

  beforeEach(() => {
    ctx = setup();
  });

  it('normalizes pull_request.opened and hands it to the executor', async () => {
    await ctx.service.handle('pull_request', 'd-1', buildPullRequestOpenedPayload());

    expect(ctx.executor.handle).toHaveBeenCalledWith(
      expect.objectContaining({ key: 'github.pull_request.opened', deliveryId: 'd-1', repositoryId: 100 }),
    );
  });

  it.each([
    ['pull_request', buildPullRequestOpenedPayload({ action: 'closed' })],
    ['push', { ref: 'refs/heads/main' }],
    ['ping', { zen: 'Keep it logically awesome.' }],
  ])('ignores %s events that no trigger handles', async (event, payload) => {
    await ctx.service.handle(event, 'd-1', payload);

    expect(ctx.executor.handle).not.toHaveBeenCalled();
    expect(ctx.access.applyRepositoriesChange).not.toHaveBeenCalled();
  });

  it('rejects a pull_request.opened payload with missing fields', async () => {
    await expect(ctx.service.handle('pull_request', 'd-1', { action: 'opened' })).rejects.toThrow(
      'Unexpected pull_request payload',
    );
    expect(ctx.executor.handle).not.toHaveBeenCalled();
  });

  it('grants the installer access to repositories of a new installation', async () => {
    await ctx.service.handle('installation', 'd-1', {
      action: 'created',
      installation: { id: 7 },
      sender: { id: 1 },
      repositories: [repo],
    });

    expect(ctx.access.applyRepositoriesChange).toHaveBeenCalledWith({
      installationId: 7,
      senderGithubId: 1,
      added: [{ id: 100, fullName: 'acme/app', private: false }],
      removed: [],
    });
  });

  it('revokes everything when the app is uninstalled', async () => {
    await ctx.service.handle('installation', 'd-1', { action: 'deleted', installation: { id: 7 }, sender: { id: 1 } });

    expect(ctx.access.removeInstallation).toHaveBeenCalledWith(7);
  });

  it('ignores other installation actions such as suspend', async () => {
    await ctx.service.handle('installation', 'd-1', { action: 'suspend', installation: { id: 7 }, sender: { id: 1 } });

    expect(ctx.access.applyRepositoriesChange).not.toHaveBeenCalled();
    expect(ctx.access.removeInstallation).not.toHaveBeenCalled();
  });

  it('syncs repositories added to and removed from an installation', async () => {
    await ctx.service.handle('installation_repositories', 'd-1', {
      action: 'added',
      installation: { id: 7 },
      sender: { id: 1 },
      repositories_added: [repo],
      repositories_removed: [{ id: 101, full_name: 'acme/old', private: true }],
    });

    expect(ctx.access.applyRepositoriesChange).toHaveBeenCalledWith({
      installationId: 7,
      senderGithubId: 1,
      added: [{ id: 100, fullName: 'acme/app', private: false }],
      removed: [101],
    });
  });

  it('rejects malformed installation payloads', async () => {
    await expect(ctx.service.handle('installation', 'd-1', { action: 'created' })).rejects.toThrow();
  });
});
