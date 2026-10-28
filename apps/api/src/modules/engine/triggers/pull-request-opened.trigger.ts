import { z } from 'zod';

import { ValidationError } from '../../../core/errors.js';
import type { TriggerEvent, TriggerNormalizer } from '../engine.types.js';

const PullRequestOpenedPayloadSchema = z.object({
  installation: z.object({ id: z.number() }),
  repository: z.object({ id: z.number(), full_name: z.string() }),
  pull_request: z.object({
    number: z.number(),
    title: z.string(),
    body: z.string().nullable(),
    html_url: z.string(),
    user: z.object({ login: z.string() }),
    head: z.object({ ref: z.string() }),
    base: z.object({ ref: z.string() }),
  }),
});

export const pullRequestOpenedTrigger: TriggerNormalizer = {
  key: 'github.pull_request.opened',
  githubEvent: 'pull_request',
  githubAction: 'opened',

  normalize(payload: unknown, deliveryId: string): TriggerEvent {
    const parsed = PullRequestOpenedPayloadSchema.safeParse(payload);
    if (!parsed.success) throw new ValidationError('Unexpected pull_request payload');
    const { installation, repository, pull_request: pr } = parsed.data;

    return {
      key: 'github.pull_request.opened',
      deliveryId,
      installationId: installation.id,
      repositoryId: repository.id,
      pullRequest: {
        repositoryFullName: repository.full_name,
        pullRequestNumber: pr.number,
        pullRequestTitle: pr.title,
        pullRequestUrl: pr.html_url,
      },
      data: {
        'pull_request.number': pr.number,
        'pull_request.title': pr.title,
        'pull_request.body': pr.body,
        'pull_request.url': pr.html_url,
        'pull_request.author': pr.user.login,
        'pull_request.head_branch': pr.head.ref,
        'pull_request.base_branch': pr.base.ref,
        'repository.full_name': repository.full_name,
      },
    };
  },
};
