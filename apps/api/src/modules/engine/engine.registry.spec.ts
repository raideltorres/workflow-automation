import { describe, expect, it, vi } from 'vitest';

import { EngineRegistry } from './engine.registry.js';
import type { ActionHandler } from './engine.types.js';
import { pullRequestOpenedTrigger } from './triggers/pull-request-opened.trigger.js';

const action: ActionHandler = { key: 'github.pull_request.comment', execute: vi.fn() };
const registry = new EngineRegistry([pullRequestOpenedTrigger], [action]);

describe('EngineRegistry', () => {
  it('finds a trigger by GitHub event and action', () => {
    expect(registry.findTrigger('pull_request', 'opened')).toBe(pullRequestOpenedTrigger);
  });

  it.each([
    ['pull_request', 'closed'],
    ['pull_request', 'synchronize'],
    ['push', undefined],
    ['pull_request', undefined],
    ['issues', 'opened'],
  ])('ignores %s.%s', (event, githubAction) => {
    expect(registry.findTrigger(event, githubAction)).toBeUndefined();
  });

  it('resolves registered actions and fails loudly for unknown ones', () => {
    expect(registry.getAction('github.pull_request.comment')).toBe(action);
    expect(() => new EngineRegistry([], []).getAction('github.pull_request.comment')).toThrow(
      'No handler registered for action github.pull_request.comment',
    );
  });
});
