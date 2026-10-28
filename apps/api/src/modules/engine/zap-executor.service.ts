import { renderTemplate } from '@workflow/shared';

import type { Logger } from '../../core/logger.js';
import type { GitHubAccessService } from '../github/github-access.service.js';
import type { ZapRunRepository } from '../runs/zap-run.repository.js';
import type { ZapRecord, ZapRepository } from '../zaps/zap.repository.js';
import type { EngineRegistry } from './engine.registry.js';
import type { TriggerEvent } from './engine.types.js';

export type RunOutcome = 'succeeded' | 'failed' | 'duplicate';

export class ZapExecutor {
  constructor(
    private readonly zaps: ZapRepository,
    private readonly runs: ZapRunRepository,
    private readonly access: GitHubAccessService,
    private readonly registry: EngineRegistry,
    private readonly logger: Logger,
  ) {}

  async handle(event: TriggerEvent): Promise<RunOutcome[]> {
    const zaps = await this.zaps.findEnabledByTrigger(event.key, event.repositoryId);
    return Promise.all(zaps.map((zap) => this.run(zap, event)));
  }

  private async run(zap: ZapRecord, event: TriggerEvent): Promise<RunOutcome> {
    const claimed = await this.runs.claim({
      zapId: zap.id,
      ownerId: zap.ownerId,
      deliveryId: event.deliveryId,
      trigger: event.pullRequest,
    });
    if (!claimed) {
      this.logger.info({ zapId: zap.id, deliveryId: event.deliveryId }, 'Skipping already processed delivery');
      return 'duplicate';
    }

    try {
      if (!(await this.access.hasRepositoryAccess(zap.ownerId, event.repositoryId))) {
        throw new Error('Zap owner no longer has access to this repository');
      }
      const input = Object.fromEntries(
        Object.entries(zap.action.input).map(([key, template]) => [key, renderTemplate(template, event.data)]),
      );
      const result = await this.registry.getAction(zap.action.key).execute(event, input);
      await this.runs.markSucceeded(claimed.id, result);
      this.logger.info({ zapId: zap.id, commentUrl: result.commentUrl }, 'Zap run succeeded');
      return 'succeeded';
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      await this.runs.markFailed(claimed.id, message);
      this.logger.warn({ zapId: zap.id, err: error }, 'Zap run failed');
      return 'failed';
    }
  }
}
