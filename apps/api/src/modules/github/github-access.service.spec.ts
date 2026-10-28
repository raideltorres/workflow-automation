import { beforeEach, describe, expect, it, vi } from 'vitest';

import { ForbiddenError, UnauthorizedError } from '../../core/errors.js';
import { buildRepository, buildUser, buildUserAccess } from '../../testing/factories.js';
import type { UserRepository } from '../users/user.repository.js';
import { GitHubAccessService } from './github-access.service.js';
import type { GitHubRepository } from './github.repository.js';

const user = buildUser();
const repository = buildRepository();

function setup() {
  const users = {
    findById: vi.fn().mockResolvedValue(user),
    upsertWithAccess: vi.fn().mockResolvedValue(user),
    revokeRepositoriesForAll: vi.fn().mockResolvedValue(undefined),
    grantRepositories: vi.fn().mockResolvedValue(undefined),
  };
  const github = {
    upsertInstallations: vi.fn().mockResolvedValue(undefined),
    findRepositoriesByIds: vi.fn().mockResolvedValue([repository]),
    findRepositoryById: vi.fn().mockResolvedValue(repository),
    findRepositoryIdsByInstallation: vi.fn().mockResolvedValue([100, 101]),
    upsertRepositories: vi.fn().mockResolvedValue(undefined),
    deleteRepositories: vi.fn().mockResolvedValue(undefined),
    deleteInstallation: vi.fn().mockResolvedValue(undefined),
  };
  const service = new GitHubAccessService(users as unknown as UserRepository, github as unknown as GitHubRepository);
  return { users, github, service };
}

describe('GitHubAccessService', () => {
  let ctx: ReturnType<typeof setup>;

  beforeEach(() => {
    ctx = setup();
  });

  it('stores installations, repositories and the user access snapshot on sign-in', async () => {
    const access = buildUserAccess({ repositories: [repository, buildRepository({ id: 101, fullName: 'acme/api' })] });

    await expect(ctx.service.syncFromSignIn(access)).resolves.toBe(user);

    expect(ctx.github.upsertInstallations).toHaveBeenCalledWith(access.installations);
    expect(ctx.github.upsertRepositories).toHaveBeenCalledWith(access.repositories);
    expect(ctx.users.upsertWithAccess).toHaveBeenCalledWith(access.profile, [100, 101]);
  });

  it('lists only repositories in the user snapshot, without installation ids', async () => {
    await expect(ctx.service.listAccessibleRepositories('user-1')).resolves.toEqual([
      { id: 100, fullName: 'acme/app', private: false },
    ]);
    expect(ctx.github.findRepositoriesByIds).toHaveBeenCalledWith([100]);
  });

  it('grants access to a repository in the user access snapshot', async () => {
    await expect(ctx.service.requireRepositoryAccess('user-1', 100)).resolves.toEqual(repository);
  });

  it('forbids repositories outside the user access snapshot without querying them', async () => {
    await expect(ctx.service.requireRepositoryAccess('user-1', 999)).rejects.toBeInstanceOf(ForbiddenError);
    expect(ctx.github.findRepositoryById).not.toHaveBeenCalled();
  });

  it('forbids a repository the app was uninstalled from even if the snapshot still lists it', async () => {
    ctx.github.findRepositoryById.mockResolvedValue(null);

    await expect(ctx.service.requireRepositoryAccess('user-1', 100)).rejects.toBeInstanceOf(ForbiddenError);
  });

  it('treats a missing user as unauthenticated', async () => {
    ctx.users.findById.mockResolvedValue(null);

    await expect(ctx.service.requireRepositoryAccess('ghost', 100)).rejects.toBeInstanceOf(UnauthorizedError);
    await expect(ctx.service.listAccessibleRepositories('ghost')).rejects.toBeInstanceOf(UnauthorizedError);
  });

  it('answers access checks for the executor without throwing', async () => {
    await expect(ctx.service.hasRepositoryAccess('user-1', 100)).resolves.toBe(true);
    await expect(ctx.service.hasRepositoryAccess('user-1', 999)).resolves.toBe(false);

    ctx.users.findById.mockResolvedValue(null);
    await expect(ctx.service.hasRepositoryAccess('ghost', 100)).resolves.toBe(false);
  });

  it('grants added repositories to the installing user only', async () => {
    await ctx.service.applyRepositoriesChange({
      installationId: 7,
      senderGithubId: 1,
      added: [{ id: 102, fullName: 'acme/new', private: false }],
      removed: [],
    });

    expect(ctx.github.upsertRepositories).toHaveBeenCalledWith([
      { id: 102, fullName: 'acme/new', private: false, installationId: 7 },
    ]);
    expect(ctx.users.grantRepositories).toHaveBeenCalledWith(1, [102]);
    expect(ctx.users.revokeRepositoriesForAll).not.toHaveBeenCalled();
  });

  it('revokes removed repositories from every user', async () => {
    await ctx.service.applyRepositoriesChange({ installationId: 7, senderGithubId: 1, added: [], removed: [100] });

    expect(ctx.users.revokeRepositoriesForAll).toHaveBeenCalledWith([100]);
    expect(ctx.github.deleteRepositories).toHaveBeenCalledWith([100]);
    expect(ctx.users.grantRepositories).not.toHaveBeenCalled();
  });

  it('revokes access for every user when an installation is removed', async () => {
    await ctx.service.removeInstallation(7);

    expect(ctx.users.revokeRepositoriesForAll).toHaveBeenCalledWith([100, 101]);
    expect(ctx.github.deleteRepositories).toHaveBeenCalledWith([100, 101]);
    expect(ctx.github.deleteInstallation).toHaveBeenCalledWith(7);
  });
});
