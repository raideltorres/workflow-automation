import { z } from 'zod';

import type { Logger } from '../../core/logger.js';
import type { EngineRegistry } from '../engine/engine.registry.js';
import type { ZapExecutor } from '../engine/zap-executor.service.js';
import type { GitHubAccessService } from '../github/github-access.service.js';

const RepositorySchema = z.object({ id: z.number(), full_name: z.string(), private: z.boolean() });

const InstallationPayloadSchema = z.object({
  action: z.string(),
  installation: z.object({ id: z.number() }),
  sender: z.object({ id: z.number() }),
  repositories: z.array(RepositorySchema).optional(),
});

const InstallationRepositoriesPayloadSchema = z.object({
  installation: z.object({ id: z.number() }),
  sender: z.object({ id: z.number() }),
  repositories_added: z.array(RepositorySchema),
  repositories_removed: z.array(RepositorySchema),
});

const ActionSchema = z.object({ action: z.string().optional() });

type RepositoryPayload = z.infer<typeof RepositorySchema>;

function toRepositoryInfo(repo: RepositoryPayload) {
  return { id: repo.id, fullName: repo.full_name, private: repo.private };
}

export class WebhookService {
  constructor(
    private readonly registry: EngineRegistry,
    private readonly executor: ZapExecutor,
    private readonly access: GitHubAccessService,
    private readonly logger: Logger,
  ) {}

  async handle(eventName: string, deliveryId: string, payload: unknown): Promise<void> {
    const action = ActionSchema.safeParse(payload).data?.action;

    const trigger = this.registry.findTrigger(eventName, action);
    if (trigger) {
      await this.executor.handle(trigger.normalize(payload, deliveryId));
      return;
    }

    switch (eventName) {
      case 'installation':
        return this.handleInstallation(payload);
      case 'installation_repositories':
        return this.handleInstallationRepositories(payload);
      default:
        this.logger.debug({ eventName, action, deliveryId }, 'Ignoring webhook event');
    }
  }

  private async handleInstallation(payload: unknown): Promise<void> {
    const event = InstallationPayloadSchema.parse(payload);
    if (event.action === 'deleted') {
      await this.access.removeInstallation(event.installation.id);
    } else if (event.action === 'created') {
      await this.access.applyRepositoriesChange({
        installationId: event.installation.id,
        senderGithubId: event.sender.id,
        added: (event.repositories ?? []).map(toRepositoryInfo),
        removed: [],
      });
    }
  }

  private async handleInstallationRepositories(payload: unknown): Promise<void> {
    const event = InstallationRepositoriesPayloadSchema.parse(payload);
    await this.access.applyRepositoriesChange({
      installationId: event.installation.id,
      senderGithubId: event.sender.id,
      added: event.repositories_added.map(toRepositoryInfo),
      removed: event.repositories_removed.map((r) => r.id),
    });
  }
}
