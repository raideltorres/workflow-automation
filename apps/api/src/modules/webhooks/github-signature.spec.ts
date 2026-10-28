import { describe, expect, it } from 'vitest';

import { signGitHubPayload, verifyGitHubSignature } from './github-signature.js';

const secret = 'webhook-secret';
const body = Buffer.from('{"action":"opened"}');

describe('verifyGitHubSignature', () => {
  it('accepts a signature computed over the exact raw body', () => {
    expect(verifyGitHubSignature(secret, body, signGitHubPayload(secret, body))).toBe(true);
  });

  it('rejects a signature made with a different secret', () => {
    expect(verifyGitHubSignature(secret, body, signGitHubPayload('other', body))).toBe(false);
  });

  it('rejects when the body was modified after signing', () => {
    const signature = signGitHubPayload(secret, body);
    expect(verifyGitHubSignature(secret, Buffer.from('{"action":"closed"}'), signature)).toBe(false);
  });

  it('rejects missing, unprefixed and truncated signatures', () => {
    const signature = signGitHubPayload(secret, body);
    expect(verifyGitHubSignature(secret, body, undefined)).toBe(false);
    expect(verifyGitHubSignature(secret, body, signature.replace('sha256=', ''))).toBe(false);
    expect(verifyGitHubSignature(secret, body, signature.slice(0, -2))).toBe(false);
  });
});
