import { expect, test } from '@playwright/test';

import { buildAccount, createZapAsCurrentUser, resetBackend, signInAs } from './support/backend';

const WEBAPP = { id: 501, fullName: 'acme/webapp', private: false, installationId: 51 };
const INTERNAL = { id: 502, fullName: 'acme/internal', private: true, installationId: 51 };
const alice = buildAccount(5001, 'alice', [WEBAPP, INTERNAL]);

test.beforeEach(async ({ request }) => {
  await resetBackend(request);
});

test('creates a GitHub "PR opened → comment" Zap in the builder', async ({ page }) => {
  await signInAs(page, alice);

  await expect(page.getByRole('heading', { name: 'Create your first Zap' })).toBeVisible();
  await page.getByRole('link', { name: 'Create Zap' }).click();
  await expect(page.getByRole('heading', { name: 'Create Zap' })).toBeVisible();

  const triggerApps = page.getByRole('radiogroup', { name: 'Trigger app' });
  await expect(triggerApps.getByRole('radio', { name: /GitHub/ })).toHaveAttribute('aria-checked', 'true');
  for (const app of ['GitLab', 'Slack', 'Linear', 'Jira', 'Sentry']) {
    await expect(triggerApps.getByRole('radio', { name: new RegExp(app) })).toBeDisabled();
  }

  await page.getByLabel('Zap name').fill('Welcome contributors');
  await page.getByRole('switch').click();
  await expect(page.getByRole('combobox', { name: 'Event' })).toContainText('Pull request opened');

  await page.getByRole('combobox', { name: 'Repository' }).click();
  await expect(page.getByRole('option', { name: 'acme/internal (private)' })).toBeVisible();
  await page.getByRole('option', { name: 'acme/webapp' }).click();

  await expect(page.getByRole('combobox', { name: 'Action' })).toContainText('Comment on pull request');
  const body = page.getByRole('textbox', { name: 'Comment' });
  await body.fill('Thanks @{{pull_request.author}}! Reviewing ');
  await page.getByLabel('Trigger fields').getByText('PR title', { exact: true }).click();
  await expect(body).toHaveValue('Thanks @{{pull_request.author}}! Reviewing {{pull_request.title}}');
  await expect(page.getByText('Thanks @octocat! Reviewing Add login page')).toBeVisible();

  await page.getByRole('button', { name: 'Save Zap' }).click();
  await expect(page.getByText('Zap created')).toBeVisible();
  await expect(page).toHaveURL(/\/zaps\/[a-f0-9]{24}$/);
  await expect(page.getByRole('heading', { name: 'Edit Zap' })).toBeVisible();
  await expect(page.getByText('No runs yet')).toBeVisible();

  await page.getByRole('link', { name: '← All Zaps' }).click();
  const card = page.getByRole('listitem').filter({ hasText: 'Welcome contributors' });
  await expect(card).toContainText('Pull request opened in acme/webapp');
  await expect(card).toContainText('Comment on pull request');
  await expect(card.getByRole('switch', { name: 'Enable Welcome contributors' })).toBeChecked();
});

test('edits and toggles a Zap and the changes survive a reload', async ({ page }) => {
  await signInAs(page, alice);
  const id = await createZapAsCurrentUser(page, {
    name: 'Greet authors',
    repositoryId: WEBAPP.id,
    body: 'Hello @{{pull_request.author}}',
    enabled: true,
  });
  await page.reload();

  const toggle = page.getByRole('switch', { name: 'Enable Greet authors' });
  await expect(toggle).toBeChecked();
  const patched = page.waitForResponse((r) => r.url().endsWith(`/api/zaps/${id}`) && r.request().method() === 'PATCH');
  await toggle.click();
  expect((await patched).status()).toBe(200);
  await page.reload();
  await expect(page.getByRole('switch', { name: 'Enable Greet authors' })).not.toBeChecked();

  await page.getByRole('link', { name: /Greet authors/ }).click();
  await expect(page.getByLabel('Zap name')).toHaveValue('Greet authors');
  await page.getByLabel('Zap name').fill('Greet first-time authors');
  await page.getByRole('combobox', { name: 'Repository' }).click();
  await page.getByRole('option', { name: 'acme/internal (private)' }).click();
  await page.getByRole('textbox', { name: 'Comment' }).fill('Welcome @{{pull_request.author}} to {{repository.full_name}}');
  await page.getByRole('switch').click();
  await page.getByRole('button', { name: 'Save Zap' }).click();
  await expect(page.getByText('Zap saved')).toBeVisible();

  await page.reload();
  await expect(page.getByLabel('Zap name')).toHaveValue('Greet first-time authors');
  await expect(page.getByRole('combobox', { name: 'Repository' })).toContainText('acme/internal');
  await expect(page.getByRole('textbox', { name: 'Comment' })).toHaveValue(
    'Welcome @{{pull_request.author}} to {{repository.full_name}}',
  );
  await expect(page.getByRole('switch')).toBeChecked();

  await page.goto('/zaps');
  await expect(page.getByRole('switch', { name: 'Enable Greet first-time authors' })).toBeChecked();
  await expect(page.getByText('Pull request opened in acme/internal')).toBeVisible();
});

test('refuses to save a comment that references fields the trigger does not provide', async ({ page }) => {
  await signInAs(page, alice);
  await page.goto('/zaps/new');

  await page.getByLabel('Zap name').fill('Leaky');
  await page.getByRole('combobox', { name: 'Repository' }).click();
  await page.getByRole('option', { name: 'acme/webapp' }).click();
  await page.getByRole('textbox', { name: 'Comment' }).fill('token: {{secrets.github_token}}');
  await page.getByRole('button', { name: 'Save Zap' }).click();

  await expect(page.getByRole('alert').first()).toContainText('Unknown fields: secrets.github_token');
  await expect(page).toHaveURL(/\/zaps\/new$/);
});
