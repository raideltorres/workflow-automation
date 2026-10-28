import { createHmac } from 'node:crypto';

import { type APIRequestContext, type Page, expect } from '@playwright/test';

export const API_URL = 'http://localhost:3100';
const CONTROL = '/api/__e2e';
// Must match TEST_WEBHOOK_SECRET in apps/api/test/support/test-app.ts, which configures the E2E API.
const WEBHOOK_SECRET = 'test-webhook-secret';
const BLANK_AVATAR = 'data:image/gif;base64,R0lGODlhAQABAAAAACw=';

export interface Repository {
  readonly id: number;
  readonly fullName: string;
  readonly private: boolean;
  readonly installationId: number;
}

export interface Account {
  readonly profile: { id: number; login: string; name: string | null; avatarUrl: string };
  readonly installations: { id: number; accountLogin: string; accountType: string }[];
  readonly repositories: readonly Repository[];
}

export interface CommentRecord {
  readonly installationId: number;
  readonly repositoryFullName: string;
  readonly pullRequestNumber: number;
  readonly body: string;
}

export function buildAccount(githubId: number, login: string, repositories: readonly Repository[]): Account {
  const installationIds = [...new Set(repositories.map((repo) => repo.installationId))];
  return {
    profile: { id: githubId, login, name: null, avatarUrl: BLANK_AVATAR },
    installations: installationIds.map((id) => ({ id, accountLogin: login, accountType: 'User' })),
    repositories,
  };
}

export async function resetBackend(request: APIRequestContext): Promise<void> {
  expect((await request.post(`${CONTROL}/reset`)).status()).toBe(204);
}

/** Signs in through the real login button, OAuth state check and callback; only GitHub's consent screen is faked. */
export async function signInAs(page: Page, account: Account): Promise<void> {
  expect((await page.request.post(`${CONTROL}/sign-in-as`, { data: account })).status()).toBe(204);
  await page.goto('/login');
  await page.getByRole('button', { name: 'Continue with GitHub' }).click();
  await expect(page).toHaveURL(/\/zaps$/);
  await expect(page.getByRole('img', { name: account.profile.login })).toBeVisible();
}

export interface ZapSeed {
  readonly name: string;
  readonly repositoryId: number;
  readonly body: string;
  readonly enabled: boolean;
}

/** Seeds a Zap through the public API as the signed-in user, for scenarios that are not about the builder. */
export async function createZapAsCurrentUser(page: Page, seed: ZapSeed): Promise<string> {
  const response = await page.request.post('/api/zaps', {
    data: {
      name: seed.name,
      enabled: seed.enabled,
      trigger: { key: 'github.pull_request.opened', config: { repositoryId: seed.repositoryId } },
      action: { key: 'github.pull_request.comment', input: { body: seed.body } },
    },
  });
  expect(response.status()).toBe(201);
  return ((await response.json()) as { id: string }).id;
}

export async function signOut(page: Page): Promise<void> {
  await page.getByRole('button', { name: 'Sign out' }).click();
  await expect(page).toHaveURL(/\/login$/);
}

export async function recordedComments(request: APIRequestContext): Promise<CommentRecord[]> {
  return (await request.get(`${CONTROL}/github/comments`)).json() as Promise<CommentRecord[]>;
}

export interface PullRequestOpened {
  readonly deliveryId: string;
  readonly repository: Repository;
  readonly number: number;
  readonly title: string;
  readonly author: string;
}

/** Delivers a webhook the way GitHub (or smee) does: straight to the API, signed over the exact body. */
export async function deliverPullRequestOpened(request: APIRequestContext, event: PullRequestOpened): Promise<void> {
  const { repository, number } = event;
  const body = JSON.stringify({
    action: 'opened',
    installation: { id: repository.installationId },
    repository: { id: repository.id, full_name: repository.fullName },
    pull_request: {
      number,
      title: event.title,
      body: null,
      html_url: `https://github.com/${repository.fullName}/pull/${number}`,
      user: { login: event.author },
      head: { ref: 'feat/e2e' },
      base: { ref: 'main' },
    },
  });
  const response = await request.post(`${API_URL}/api/webhooks/github`, {
    headers: {
      'content-type': 'application/json',
      'x-github-event': 'pull_request',
      'x-github-delivery': event.deliveryId,
      'x-hub-signature-256': `sha256=${createHmac('sha256', WEBHOOK_SECRET).update(body).digest('hex')}`,
    },
    data: body,
  });
  expect(response.status()).toBe(202);
}
