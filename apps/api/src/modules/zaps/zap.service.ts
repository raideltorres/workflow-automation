import { ZapInputSchema, type Zap, type ZapInput, type ZapPatch, type ZapRun } from '@workflow/shared';

import { NotFoundError, ValidationError } from '../../core/errors.js';
import type { GitHubAccessService } from '../github/github-access.service.js';
import type { ZapRunRepository } from '../runs/zap-run.repository.js';
import type { ZapRecord, ZapRepository } from './zap.repository.js';

function toDto({ ownerId: _ownerId, ...zap }: ZapRecord): Zap {
  return zap;
}

export class ZapService {
  constructor(
    private readonly zaps: ZapRepository,
    private readonly runs: ZapRunRepository,
    private readonly access: GitHubAccessService,
  ) {}

  async list(ownerId: string): Promise<Zap[]> {
    return (await this.zaps.listByOwner(ownerId)).map(toDto);
  }

  async get(ownerId: string, id: string): Promise<Zap> {
    return toDto(await this.requireOwned(ownerId, id));
  }

  async create(ownerId: string, input: ZapInput): Promise<Zap> {
    const repository = await this.access.requireRepositoryAccess(ownerId, input.trigger.config.repositoryId);
    const zap = await this.zaps.create(ownerId, { ...input, repositoryFullName: repository.fullName });
    return toDto(zap);
  }

  async update(ownerId: string, id: string, patch: ZapPatch): Promise<Zap> {
    const existing = await this.requireOwned(ownerId, id);
    const merged = ZapInputSchema.safeParse({
      name: patch.name ?? existing.name,
      enabled: patch.enabled ?? existing.enabled,
      trigger: patch.trigger ?? { key: existing.trigger.key, config: { repositoryId: existing.trigger.config.repositoryId } },
      action: patch.action ?? existing.action,
    });
    if (!merged.success) {
      throw new ValidationError(
        'Invalid zap',
        merged.error.issues.map((issue) => ({ path: issue.path.join('.'), message: issue.message })),
      );
    }

    const repository = await this.access.requireRepositoryAccess(ownerId, merged.data.trigger.config.repositoryId);
    const updated = await this.zaps.updateOwned(id, ownerId, {
      ...merged.data,
      repositoryFullName: repository.fullName,
    });
    if (!updated) throw new NotFoundError('Zap');
    return toDto(updated);
  }

  async delete(ownerId: string, id: string): Promise<void> {
    const deleted = await this.zaps.deleteOwned(id, ownerId);
    if (!deleted) throw new NotFoundError('Zap');
  }

  async listRuns(ownerId: string, id: string): Promise<ZapRun[]> {
    const zap = await this.requireOwned(ownerId, id);
    return this.runs.listByZap(zap.id);
  }

  private async requireOwned(ownerId: string, id: string): Promise<ZapRecord> {
    const zap = await this.zaps.findOwned(id, ownerId);
    if (!zap) throw new NotFoundError('Zap');
    return zap;
  }
}
