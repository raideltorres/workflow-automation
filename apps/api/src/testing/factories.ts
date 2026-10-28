import type { ZapInput } from '@workflow/shared';

import type { GitHubRepositoryInfo, GitHubUserAccess } from '../integrations/github/github.gateway.js';
import type { TriggerEvent } from '../modules/engine/engine.types.js';
import type { UserRecord } from '../modules/users/user.repository.js';
import type { ZapRecord } from '../modules/zaps/zap.repository.js';

export function buildZap(overrides: Partial<ZapRecord> = {}): ZapRecord {
  return {
    id: 'zap-1',
    ownerId: 'user-1',
    name: 'Thank contributors',
    enabled: true,
    trigger: { key: 'github.pull_request.opened', config: { repositoryId: 100, repositoryFullName: 'acme/app' } },
    action: { key: 'github.pull_request.comment', input: { body: 'Thanks @{{pull_request.author}}!' } },
    createdAt: '2026-10-27T00:00:00.000Z',
    updatedAt: '2026-10-27T00:00:00.000Z',
    ...overrides,
  };
}

export function buildZapInput(overrides: Partial<ZapInput> & { repositoryId?: number } = {}): ZapInput {
  const { repositoryId = 100, ...rest } = overrides;
  return {
    name: 'Thank contributors',
    enabled: true,
    trigger: { key: 'github.pull_request.opened', config: { repositoryId } },
    action: { key: 'github.pull_request.comment', input: { body: 'Thanks @{{pull_request.author}} for #{{pull_request.number}}!' } },
    ...rest,
  };
}

export function buildUser(overrides: Partial<UserRecord> = {}): UserRecord {
  return {
    id: 'user-1',
    githubId: 1,
    login: 'octocat',
    name: null,
    avatarUrl: 'https://avatars.example/octocat',
    repositoryIds: [100],
    ...overrides,
  };
}

export function buildRepository(overrides: Partial<GitHubRepositoryInfo> = {}): GitHubRepositoryInfo {
  return { id: 100, fullName: 'acme/app', private: false, installationId: 7, ...overrides };
}

export function buildUserAccess(
  overrides: { githubId?: number; login?: string; repositories?: GitHubRepositoryInfo[] } = {},
): GitHubUserAccess {
  const { githubId = 1, login = 'octocat', repositories = [buildRepository()] } = overrides;
  const installationIds = [...new Set(repositories.map((r) => r.installationId))];
  return {
    profile: { id: githubId, login, name: null, avatarUrl: `https://avatars.example/${login}` },
    installations: installationIds.map((id) => ({ id, accountLogin: login, accountType: 'User' })),
    repositories,
  };
}

export function buildTriggerEvent(overrides: Partial<TriggerEvent> = {}): TriggerEvent {
  return {
    key: 'github.pull_request.opened',
    deliveryId: 'delivery-1',
    installationId: 7,
    repositoryId: 100,
    pullRequest: {
      repositoryFullName: 'acme/app',
      pullRequestNumber: 42,
      pullRequestTitle: 'Add login',
      pullRequestUrl: 'https://github.com/acme/app/pull/42',
    },
    data: { 'pull_request.author': 'octocat', 'pull_request.title': 'Add login' },
    ...overrides,
  };
}

export function buildPullRequestOpenedPayload(
  overrides: { action?: string; repositoryId?: number; fullName?: string; number?: number; installationId?: number } = {},
) {
  const {
    action = 'opened',
    repositoryId = 100,
    fullName = 'acme/app',
    number = 42,
    installationId = 7,
  } = overrides;
  return {
    action,
    installation: { id: installationId },
    repository: { id: repositoryId, full_name: fullName },
    pull_request: {
      number,
      title: 'Add login',
      body: null,
      html_url: `https://github.com/${fullName}/pull/${number}`,
      user: { login: 'octocat' },
      head: { ref: 'feat/login' },
      base: { ref: 'main' },
    },
  };
}
