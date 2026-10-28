import type { TriggerEvent } from '../modules/engine/engine.types.js';
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

export function buildPullRequestOpenedPayload() {
  return {
    action: 'opened',
    installation: { id: 7 },
    repository: { id: 100, full_name: 'acme/app' },
    pull_request: {
      number: 42,
      title: 'Add login',
      body: null,
      html_url: 'https://github.com/acme/app/pull/42',
      user: { login: 'octocat' },
      head: { ref: 'feat/login' },
      base: { ref: 'main' },
    },
  };
}
