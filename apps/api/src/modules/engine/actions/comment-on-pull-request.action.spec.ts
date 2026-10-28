import { describe, expect, it, vi } from 'vitest';

import type { GitHubGateway } from '../../../integrations/github/github.gateway.js';
import { buildTriggerEvent } from '../../../testing/factories.js';
import { CommentOnPullRequestAction } from './comment-on-pull-request.action.js';

function setup() {
  const github = {
    createPullRequestComment: vi
      .fn<GitHubGateway['createPullRequestComment']>()
      .mockResolvedValue({ url: 'https://github.com/acme/app/pull/42#issuecomment-1' }),
  };
  return { github, action: new CommentOnPullRequestAction(github as unknown as GitHubGateway) };
}

describe('CommentOnPullRequestAction', () => {
  it('comments on the triggering pull request with the installation token context', async () => {
    const { github, action } = setup();

    const result = await action.execute(buildTriggerEvent(), { body: '  Thanks!  ' });

    expect(github.createPullRequestComment).toHaveBeenCalledWith({
      installationId: 7,
      repositoryFullName: 'acme/app',
      pullRequestNumber: 42,
      body: 'Thanks!',
    });
    expect(result).toEqual({ commentUrl: 'https://github.com/acme/app/pull/42#issuecomment-1' });
  });

  it.each<Record<string, string>>([{ body: '   ' }, {}])('refuses to post an empty comment (%j)', async (input) => {
    const { github, action } = setup();

    await expect(action.execute(buildTriggerEvent(), input)).rejects.toThrow('Rendered comment is empty');
    expect(github.createPullRequestComment).not.toHaveBeenCalled();
  });

  it('propagates GitHub failures so the executor can record them', async () => {
    const { github, action } = setup();
    github.createPullRequestComment.mockRejectedValue(new Error('Bad credentials'));

    await expect(action.execute(buildTriggerEvent(), { body: 'Hi' })).rejects.toThrow('Bad credentials');
  });
});
