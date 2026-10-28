import { describe, expect, it } from 'vitest';

import { ACTIONS, APPS, TRIGGERS, findAction, findTrigger } from './catalog.js';

describe('catalog', () => {
  it('only offers triggers and actions for apps that can actually run', () => {
    const available = new Set(APPS.filter((app) => app.status === 'available').map((app) => app.id));

    for (const definition of [...TRIGGERS, ...ACTIONS]) {
      expect(available.has(definition.app)).toBe(true);
    }
  });

  it('lists several developer tools, with GitHub as the only available one', () => {
    expect(APPS.length).toBeGreaterThan(1);
    expect(APPS.filter((app) => app.status === 'available').map((app) => app.id)).toEqual(['github']);
  });

  it('finds catalog entries by key', () => {
    expect(findTrigger('github.pull_request.opened').app).toBe('github');
    expect(findAction('github.pull_request.comment').inputFields.map((field) => field.key)).toEqual(['body']);
  });

  it('throws on keys outside the catalog', () => {
    expect(() => findTrigger('nope' as never)).toThrow('Unknown trigger: nope');
    expect(() => findAction('nope' as never)).toThrow('Unknown action: nope');
  });
});
