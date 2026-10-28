import { describe, expect, it } from 'vitest';

import { findTrigger } from '@workflow/shared';

import { ValidationError } from '../../../core/errors.js';
import { buildPullRequestOpenedPayload } from '../../../testing/factories.js';
import { pullRequestOpenedTrigger } from './pull-request-opened.trigger.js';

describe('pullRequestOpenedTrigger', () => {
  it('normalizes a webhook payload into a trigger event', () => {
    const event = pullRequestOpenedTrigger.normalize(buildPullRequestOpenedPayload(), 'delivery-1');

    expect(event).toMatchObject({
      deliveryId: 'delivery-1',
      installationId: 7,
      repositoryId: 100,
      pullRequest: { repositoryFullName: 'acme/app', pullRequestNumber: 42 },
    });
    expect(event.data['pull_request.author']).toBe('octocat');
  });

  it('exposes a value for every output field declared in the catalog', () => {
    const event = pullRequestOpenedTrigger.normalize(buildPullRequestOpenedPayload(), 'delivery-1');
    const declared = findTrigger('github.pull_request.opened').outputFields.map((f) => f.key);

    expect(Object.keys(event.data).sort()).toEqual([...declared].sort());
  });

  it('rejects payloads without the fields it needs', () => {
    expect(() => pullRequestOpenedTrigger.normalize({ action: 'opened' }, 'd')).toThrow(ValidationError);
  });
});
