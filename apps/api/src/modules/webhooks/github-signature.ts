import { createHmac, timingSafeEqual } from 'node:crypto';

const SIGNATURE_PREFIX = 'sha256=';

export function signGitHubPayload(secret: string, payload: Buffer | string): string {
  return SIGNATURE_PREFIX + createHmac('sha256', secret).update(payload).digest('hex');
}

/** Verifies `X-Hub-Signature-256` against the exact raw request body. */
export function verifyGitHubSignature(secret: string, rawBody: Buffer, signatureHeader: string | undefined): boolean {
  if (!signatureHeader?.startsWith(SIGNATURE_PREFIX)) return false;
  const expected = Buffer.from(signGitHubPayload(secret, rawBody));
  const received = Buffer.from(signatureHeader);
  return expected.length === received.length && timingSafeEqual(expected, received);
}
