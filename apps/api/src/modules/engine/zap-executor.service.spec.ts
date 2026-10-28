import { beforeEach, describe, expect, it, vi } from 'vitest';

import { createLogger } from '../../core/logger.js';
import { buildTriggerEvent, buildZap } from '../../testing/factories.js';
import type { GitHubAccessService } from '../github/github-access.service.js';
import type { ZapRunRepository } from '../runs/zap-run.repository.js';
import type { ZapRepository } from '../zaps/zap.repository.js';
import { EngineRegistry } from './engine.registry.js';
import type { ActionHandler } from './engine.types.js';
import { ZapExecutor } from './zap-executor.service.js';

function setup() {
  const zaps = { findEnabledByTrigger: vi.fn().mockResolvedValue([buildZap()]) };
  const runs = {
    claim: vi.fn().mockResolvedValue({ id: 'run-1' }),
    markSucceeded: vi.fn().mockResolvedValue(undefined),
    markFailed: vi.fn().mockResolvedValue(undefined),
  };
  const access = { hasRepositoryAccess: vi.fn().mockResolvedValue(true) };
  const action = {
    key: 'github.pull_request.comment' as const,
    execute: vi.fn<ActionHandler['execute']>().mockResolvedValue({ commentUrl: 'https://github.com/c/1' }),
  };
  const executor = new ZapExecutor(
    zaps as unknown as ZapRepository,
    runs as unknown as ZapRunRepository,
    access as unknown as GitHubAccessService,
    new EngineRegistry([], [action]),
    createLogger('test'),
  );
  return { zaps, runs, access, action, executor };
}

describe('ZapExecutor', () => {
  let ctx: ReturnType<typeof setup>;

  beforeEach(() => {
    ctx = setup();
  });

  it('renders the template with trigger data and records a successful run', async () => {
    const event = buildTriggerEvent();

    const outcomes = await ctx.executor.handle(event);

    expect(outcomes).toEqual(['succeeded']);
    expect(ctx.zaps.findEnabledByTrigger).toHaveBeenCalledWith('github.pull_request.opened', 100);
    expect(ctx.action.execute).toHaveBeenCalledWith(event, { body: 'Thanks @octocat!' });
    expect(ctx.runs.markSucceeded).toHaveBeenCalledWith('run-1', { commentUrl: 'https://github.com/c/1' });
  });

  it('claims the run with the delivery id before executing', async () => {
    await ctx.executor.handle(buildTriggerEvent({ deliveryId: 'abc' }));

    expect(ctx.runs.claim).toHaveBeenCalledWith(
      expect.objectContaining({ zapId: 'zap-1', ownerId: 'user-1', deliveryId: 'abc' }),
    );
  });

  it('skips a delivery this zap already processed', async () => {
    ctx.runs.claim.mockResolvedValue(null);

    const outcomes = await ctx.executor.handle(buildTriggerEvent());

    expect(outcomes).toEqual(['duplicate']);
    expect(ctx.action.execute).not.toHaveBeenCalled();
  });

  it('marks the run failed when the action throws', async () => {
    ctx.action.execute.mockRejectedValue(new Error('GitHub is down'));

    const outcomes = await ctx.executor.handle(buildTriggerEvent());

    expect(outcomes).toEqual(['failed']);
    expect(ctx.runs.markFailed).toHaveBeenCalledWith('run-1', 'GitHub is down');
  });

  it('does not act when the owner lost access to the repository', async () => {
    ctx.access.hasRepositoryAccess.mockResolvedValue(false);

    const outcomes = await ctx.executor.handle(buildTriggerEvent());

    expect(outcomes).toEqual(['failed']);
    expect(ctx.action.execute).not.toHaveBeenCalled();
  });

  it('does nothing when no enabled zap matches', async () => {
    ctx.zaps.findEnabledByTrigger.mockResolvedValue([]);

    expect(await ctx.executor.handle(buildTriggerEvent())).toEqual([]);
    expect(ctx.runs.claim).not.toHaveBeenCalled();
  });
});
