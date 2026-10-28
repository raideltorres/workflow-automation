import { expect, test } from '@playwright/test';

import {
  buildAccount,
  createZapAsCurrentUser,
  deliverPullRequestOpened,
  recordedComments,
  resetBackend,
  signInAs,
} from './support/backend';

const WEBAPP = { id: 501, fullName: 'acme/webapp', private: false, installationId: 51 };
const alice = buildAccount(5001, 'alice', [WEBAPP]);

test.beforeEach(async ({ request }) => {
  await resetBackend(request);
});

test('a signed "pull request opened" webhook comments on that PR and shows up in run history', async ({
  page,
  request,
}) => {
  await signInAs(page, alice);
  const id = await createZapAsCurrentUser(page, {
    name: 'Thank PR authors',
    repositoryId: WEBAPP.id,
    body: 'Thanks @{{pull_request.author}} for "{{pull_request.title}}" (#{{pull_request.number}}) in {{repository.full_name}}',
    enabled: true,
  });
  await deliverPullRequestOpened(request, {
    deliveryId: 'e2e-delivery-1',
    repository: WEBAPP,
    number: 17,
    title: 'Add dark mode',
    author: 'octo-dev',
  });

  await expect.poll(() => recordedComments(request)).toEqual([
    {
      installationId: WEBAPP.installationId,
      repositoryFullName: 'acme/webapp',
      pullRequestNumber: 17,
      body: 'Thanks @octo-dev for "Add dark mode" (#17) in acme/webapp',
    },
  ]);

  await page.goto(`/zaps/${id}`);
  const runRow = page.getByRole('row').filter({ hasText: '#17 Add dark mode' });
  await expect(async () => {
    await page.getByRole('button', { name: 'Refresh' }).click();
    await expect(runRow).toContainText('succeeded', { timeout: 1_000 });
  }).toPass();
  await expect(runRow.getByRole('link', { name: '#17 Add dark mode' })).toHaveAttribute(
    'href',
    'https://github.com/acme/webapp/pull/17',
  );
  await expect(runRow.getByRole('link', { name: 'View comment' })).toHaveAttribute(
    'href',
    /^https:\/\/github\.com\/acme\/webapp\/pull\/17#issuecomment-/,
  );
});
