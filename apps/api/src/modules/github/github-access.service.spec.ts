import { beforeEach, describe, expect, it, vi } from 'vitest';

import { ForbiddenError, UnauthorizedError } from '../../core/errors.js';
import type { UserRepository } from '../users/user.repository.js';
import { GitHubAccessService } from './github-access.service.js';
import type { GitHubRepository } from './github.repository.js';

const user = { id: 'user-1', githubId: 1, login: 'octocat', name: null, avatarUrl: 'a', repositoryIds: [100] };
const repository = { id: 100, fullName: 'acme/app', private: false, installationId: 7 };

function setup() {
  const users = {
    findById: vi.fn().mockResolvedValue(user),
    revokeRepositoriesForAll: vi.fn().mockResolvedValue(undefined),
    grantRepositories: vi.fn().mockResolvedValue(undefined),
  };
  const github = {
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

  it('grants access to a repository in the user access snapshot', async () => {
    await expect(ctx.service.requireRepositoryAccess('user-1', 100)).resolves.toEqual(repository);
  });

  it('forbids repositories outside the user access snapshot without querying them', async () => {
    await expect(ctx.service.requireRepositoryAccess('user-1', 999)).rejects.toBeInstanceOf(ForbiddenError);
    expect(ctx.github.findRepositoryById).not.toHaveBeenCalled();
  });

  it('treats a missing user as unauthenticated', async () => {
    ctx.users.findById.mockResolvedValue(null);

    await expect(ctx.service.requireRepositoryAccess('ghost', 100)).rejects.toBeInstanceOf(UnauthorizedError);
  });

  it('revokes access for every user when an installation is removed', async () => {
    await ctx.service.removeInstallation(7);

    expect(ctx.users.revokeRepositoriesForAll).toHaveBeenCalledWith([100, 101]);
    expect(ctx.github.deleteRepositories).toHaveBeenCalledWith([100, 101]);
    expect(ctx.github.deleteInstallation).toHaveBeenCalledWith(7);
  });
});
