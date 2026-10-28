import { expect, test } from '@playwright/test';

import { buildAccount, createZapAsCurrentUser, resetBackend, signInAs, signOut } from './support/backend';

const ALICE_PRIVATE = { id: 601, fullName: 'alice/private-repo', private: true, installationId: 61 };
const BOB_TOOLS = { id: 701, fullName: 'bob/tools', private: false, installationId: 71 };
const alice = buildAccount(6001, 'alice', [ALICE_PRIVATE]);
const bob = buildAccount(7001, 'bob', [BOB_TOOLS]);

test.beforeEach(async ({ request }) => {
  await resetBackend(request);
});

test("a user can neither see nor change another user's Zaps, in the UI or through the API", async ({ page }) => {
  await signInAs(page, alice);
  const aliceZapId = await createZapAsCurrentUser(page, {
    name: "Alice's private Zap",
    repositoryId: ALICE_PRIVATE.id,
    body: 'Hi @{{pull_request.author}}',
    enabled: true,
  });
  await signOut(page);

  await signInAs(page, bob);
  await expect(page.getByRole('heading', { name: 'Create your first Zap' })).toBeVisible();
  await expect(page.getByText("Alice's private Zap")).toHaveCount(0);

  await page.goto(`/zaps/${aliceZapId}`);
  await expect(page.getByRole('alert')).toHaveText('Zap not found');
  await expect(page.getByLabel('Zap name')).toHaveCount(0);

  await page.goto('/zaps/new');
  await page.getByRole('combobox', { name: 'Repository' }).click();
  await expect(page.getByRole('option')).toHaveText(['bob/tools']);
  await page.keyboard.press('Escape');

  const api = page.request;
  expect((await api.get('/api/zaps')).status()).toBe(200);
  expect(await (await api.get('/api/zaps')).json()).toEqual([]);
  expect((await api.get(`/api/zaps/${aliceZapId}`)).status()).toBe(404);
  expect((await api.get(`/api/zaps/${aliceZapId}/runs`)).status()).toBe(404);
  expect((await api.patch(`/api/zaps/${aliceZapId}`, { data: { enabled: false } })).status()).toBe(404);
  expect((await api.delete(`/api/zaps/${aliceZapId}`)).status()).toBe(404);
  const hijack = await api.post('/api/zaps', {
    data: {
      name: 'Hijack',
      enabled: true,
      trigger: { key: 'github.pull_request.opened', config: { repositoryId: ALICE_PRIVATE.id } },
      action: { key: 'github.pull_request.comment', input: { body: 'pwned' } },
    },
  });
  expect(hijack.status()).toBe(403);
  await signOut(page);

  await signInAs(page, alice);
  await expect(page.getByRole('switch', { name: "Enable Alice's private Zap" })).toBeChecked();
  await expect(page.getByRole('listitem')).toHaveCount(1);
});

test('signed-out visitors are sent to the login page and the API refuses them', async ({ page, request }) => {
  await page.goto('/zaps');
  await expect(page).toHaveURL(/\/login$/);
  await expect(page.getByRole('button', { name: 'Continue with GitHub' })).toBeVisible();

  expect((await request.get('/api/zaps')).status()).toBe(401);
});
