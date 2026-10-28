import { describe, expect, it } from 'vitest';

import { COMMENT_BODY_MAX_LENGTH, ZAP_NAME_MAX_LENGTH, ZapInputSchema, ZapPatchSchema } from './zap.js';

const validInput = {
  name: 'Thank contributors',
  enabled: true,
  trigger: { key: 'github.pull_request.opened', config: { repositoryId: 1 } },
  action: { key: 'github.pull_request.comment', input: { body: 'Thanks @{{pull_request.author}}!' } },
};

function issuePaths(input: unknown): string[] {
  const result = ZapInputSchema.safeParse(input);
  return result.success ? [] : result.error.issues.map((issue) => issue.path.join('.'));
}

describe('ZapInputSchema', () => {
  it('accepts a zap that only uses fields exposed by its trigger', () => {
    expect(ZapInputSchema.safeParse(validInput).success).toBe(true);
  });

  it('trims the name and comment body', () => {
    const parsed = ZapInputSchema.parse({
      ...validInput,
      name: '  Greeter  ',
      action: { ...validInput.action, input: { body: '  Hi  ' } },
    });

    expect(parsed.name).toBe('Greeter');
    expect(parsed.action.input.body).toBe('Hi');
  });

  it('rejects template fields the trigger does not expose', () => {
    const result = ZapInputSchema.safeParse({
      ...validInput,
      action: { ...validInput.action, input: { body: 'Hi {{user.password}}' } },
    });
    expect(result.success).toBe(false);
    expect(result.error?.issues[0]?.path).toEqual(['action', 'input', 'body']);
    expect(result.error?.issues[0]?.message).toBe('Unknown fields: user.password');
  });

  it('rejects unknown trigger keys and blank names', () => {
    expect(issuePaths({ ...validInput, name: '  ' })).toEqual(['name']);
    expect(issuePaths({ ...validInput, trigger: { key: 'github.push', config: { repositoryId: 1 } } })).toEqual([
      'trigger.key',
    ]);
  });

  it('rejects actions that are not in the catalog', () => {
    expect(issuePaths({ ...validInput, action: { key: 'slack.message', input: { body: 'Hi' } } })).toEqual([
      'action.key',
    ]);
  });

  it('requires a non-empty comment body within the length limit', () => {
    expect(issuePaths({ ...validInput, action: { ...validInput.action, input: { body: '   ' } } })).toEqual([
      'action.input.body',
    ]);
    expect(
      issuePaths({
        ...validInput,
        action: { ...validInput.action, input: { body: 'x'.repeat(COMMENT_BODY_MAX_LENGTH + 1) } },
      }),
    ).toEqual(['action.input.body']);
  });

  it('caps the name length', () => {
    expect(issuePaths({ ...validInput, name: 'x'.repeat(ZAP_NAME_MAX_LENGTH + 1) })).toEqual(['name']);
  });

  it.each([0, -1, 1.5, '1'])('rejects repository id %j', (repositoryId) => {
    expect(issuePaths({ ...validInput, trigger: { ...validInput.trigger, config: { repositoryId } } })).toEqual([
      'trigger.config.repositoryId',
    ]);
  });

  it('requires every top-level field', () => {
    expect(issuePaths({}).sort()).toEqual(['action', 'enabled', 'name', 'trigger']);
  });
});

describe('ZapPatchSchema', () => {
  it('accepts a partial update such as a toggle', () => {
    expect(ZapPatchSchema.safeParse({ enabled: false }).success).toBe(true);
  });

  it('still validates the fields that are present', () => {
    expect(ZapPatchSchema.safeParse({ name: '' }).success).toBe(false);
    expect(ZapPatchSchema.safeParse({ enabled: 'yes' }).success).toBe(false);
  });
});
