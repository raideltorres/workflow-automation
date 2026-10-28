import type { CurrentUser, RepositoryListResponse, Zap, ZapRun } from '@workflow/shared';

export function buildUser(overrides: Partial<CurrentUser> = {}): CurrentUser {
  return { id: 'user-1', login: 'octocat', name: 'The Octocat', avatarUrl: 'https://avatars.example/octocat', ...overrides };
}

export function buildZap(overrides: Partial<Zap> = {}): Zap {
  return {
    id: 'zap-1',
    name: 'Thank contributors',
    enabled: true,
    trigger: { key: 'github.pull_request.opened', config: { repositoryId: 100, repositoryFullName: 'acme/app' } },
    action: { key: 'github.pull_request.comment', input: { body: 'Thanks @{{pull_request.author}}!' } },
    createdAt: '2026-10-28T10:00:00.000Z',
    updatedAt: '2026-10-28T10:00:00.000Z',
    ...overrides,
  };
}

export function buildRun(overrides: Partial<ZapRun> = {}): ZapRun {
  return {
    id: 'run-1',
    zapId: 'zap-1',
    deliveryId: 'delivery-1',
    status: 'succeeded',
    trigger: {
      repositoryFullName: 'acme/app',
      pullRequestNumber: 42,
      pullRequestTitle: 'Add login',
      pullRequestUrl: 'https://github.com/acme/app/pull/42',
    },
    output: { commentUrl: 'https://github.com/acme/app/pull/42#issuecomment-1' },
    startedAt: '2026-10-28T10:00:00.000Z',
    finishedAt: '2026-10-28T10:00:01.000Z',
    ...overrides,
  };
}

export function buildRepositoryList(overrides: Partial<RepositoryListResponse> = {}): RepositoryListResponse {
  return {
    repositories: [
      { id: 100, fullName: 'acme/app', private: false },
      { id: 101, fullName: 'acme/secret', private: true },
    ],
    installUrl: 'https://github.com/apps/workflow-test/installations/new',
    ...overrides,
  };
}
