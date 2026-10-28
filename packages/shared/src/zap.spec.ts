import { describe, expect, it } from 'vitest';

import { ZapInputSchema } from './zap.js';

const validInput = {
  name: 'Thank contributors',
  enabled: true,
  trigger: { key: 'github.pull_request.opened', config: { repositoryId: 1 } },
  action: { key: 'github.pull_request.comment', input: { body: 'Thanks @{{pull_request.author}}!' } },
};

describe('ZapInputSchema', () => {
  it('accepts a zap that only uses fields exposed by its trigger', () => {
    expect(ZapInputSchema.safeParse(validInput).success).toBe(true);
  });

  it('rejects template fields the trigger does not expose', () => {
    const result = ZapInputSchema.safeParse({
      ...validInput,
      action: { ...validInput.action, input: { body: 'Hi {{user.password}}' } },
    });
    expect(result.success).toBe(false);
    expect(result.error?.issues[0]?.path).toEqual(['action', 'input', 'body']);
  });

  it('rejects unknown trigger keys and blank names', () => {
    expect(ZapInputSchema.safeParse({ ...validInput, name: '  ' }).success).toBe(false);
    expect(
      ZapInputSchema.safeParse({ ...validInput, trigger: { key: 'github.push', config: { repositoryId: 1 } } }).success,
    ).toBe(false);
  });
});
