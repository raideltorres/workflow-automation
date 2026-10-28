import type { AccessibleRepository } from '@workflow/shared';

import { ForbiddenError, UnauthorizedError } from '../../core/errors.js';
import type { GitHubRepositoryInfo, GitHubUserAccess } from '../../integrations/github/github.gateway.js';
import type { UserRecord, UserRepository } from '../users/user.repository.js';
import type { GitHubRepository } from './github.repository.js';

export interface InstallationRepositoriesChange {
  readonly installationId: number;
  readonly senderGithubId: number;
  readonly added: readonly Omit<GitHubRepositoryInfo, 'installationId'>[];
  readonly removed: readonly number[];
}

/** Source of truth for which GitHub repositories a user may automate. */
export class GitHubAccessService {
  constructor(
    private readonly users: UserRepository,
    private readonly github: GitHubRepository,
  ) {}

  async syncFromSignIn(access: GitHubUserAccess): Promise<UserRecord> {
    await this.github.upsertInstallations(access.installations);
    await this.github.upsertRepositories(access.repositories);
    return this.users.upsertWithAccess(
      access.profile,
      access.repositories.map((r) => r.id),
    );
  }

  async listAccessibleRepositories(userId: string): Promise<AccessibleRepository[]> {
    const user = await this.requireUser(userId);
    const repositories = await this.github.findRepositoriesByIds(user.repositoryIds);
    return repositories.map((r) => ({ id: r.id, fullName: r.fullName, private: r.private }));
  }

  async requireRepositoryAccess(userId: string, repositoryId: number): Promise<GitHubRepositoryInfo> {
    const user = await this.requireUser(userId);
    const repository = user.repositoryIds.includes(repositoryId)
      ? await this.github.findRepositoryById(repositoryId)
      : null;
    if (!repository) throw new ForbiddenError('The GitHub App is not installed on this repository for your account');
    return repository;
  }

  async hasRepositoryAccess(userId: string, repositoryId: number): Promise<boolean> {
    const user = await this.users.findById(userId);
    return user?.repositoryIds.includes(repositoryId) ?? false;
  }

  async applyRepositoriesChange(change: InstallationRepositoriesChange): Promise<void> {
    if (change.added.length > 0) {
      await this.github.upsertRepositories(change.added.map((r) => ({ ...r, installationId: change.installationId })));
      await this.users.grantRepositories(
        change.senderGithubId,
        change.added.map((r) => r.id),
      );
    }
    if (change.removed.length > 0) {
      await this.users.revokeRepositoriesForAll(change.removed);
      await this.github.deleteRepositories(change.removed);
    }
  }

  async removeInstallation(installationId: number): Promise<void> {
    const repositoryIds = await this.github.findRepositoryIdsByInstallation(installationId);
    await this.users.revokeRepositoriesForAll(repositoryIds);
    await this.github.deleteRepositories(repositoryIds);
    await this.github.deleteInstallation(installationId);
  }

  private async requireUser(userId: string): Promise<UserRecord> {
    const user = await this.users.findById(userId);
    if (!user) throw new UnauthorizedError();
    return user;
  }
}
