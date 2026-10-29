import { describe, expect, it, vi } from 'vitest';

import { ExternalServiceError } from '../../core/errors.js';
import { OpenAiCopilotGateway } from './openai-copilot.gateway.js';

const validOutput = JSON.stringify({
  name: 'Thank contributors',
  comment: 'Thanks @{{pull_request.author}}!',
});

function response(body: unknown, ok = true, status = 200): Response {
  return new Response(JSON.stringify(body), { status, headers: { 'content-type': 'application/json' } });
}

function setup(fetchImpl = vi.fn<typeof fetch>().mockResolvedValue(response({ output_text: validOutput }))) {
  return { fetchImpl, gateway: new OpenAiCopilotGateway('api-key', 'gpt-4o-mini', fetchImpl) };
}

describe('OpenAiCopilotGateway', () => {
  it('requests a strict JSON schema and validates a structured Zap draft', async () => {
    const { gateway, fetchImpl } = setup();

    await expect(gateway.draftZap('Thank contributors')).resolves.toEqual(JSON.parse(validOutput));

    const [url, init] = fetchImpl.mock.calls[0]!;
    expect(url).toBe('https://api.openai.com/v1/responses');
    expect(init).toMatchObject({
      method: 'POST',
      headers: { authorization: 'Bearer api-key', 'content-type': 'application/json' },
    });
    expect(JSON.parse(String(init?.body))).toMatchObject({
      model: 'gpt-4o-mini',
      text: { format: { type: 'json_schema', strict: true, name: 'github_pr_comment_zap_draft' } },
    });
  });

  it('wraps network, HTTP, malformed JSON, missing output, and invalid drafts', async () => {
    const cases: Array<[string, typeof fetch, string]> = [
      ['network failure', vi.fn<typeof fetch>().mockRejectedValue(new Error('offline')), 'could not be reached'],
      ['HTTP failure', vi.fn<typeof fetch>().mockResolvedValue(response({}, false, 429)), 'returned 429'],
      ['malformed response', vi.fn<typeof fetch>().mockResolvedValue(new Response('not-json')), 'returned invalid JSON'],
      ['no output', vi.fn<typeof fetch>().mockResolvedValue(response({ output: [] })), 'returned no structured output'],
      ['invalid draft', vi.fn<typeof fetch>().mockResolvedValue(response({ output_text: '{"name":""}' })), 'returned an invalid Zap draft'],
    ];

    for (const [, fetchImpl, message] of cases) {
      const { gateway } = setup(fetchImpl);
      const error = await gateway.draftZap('draft').catch((cause: unknown) => cause);
      expect(error).toBeInstanceOf(ExternalServiceError);
      expect((error as ExternalServiceError).message).toBe(`OpenAI: ${message}`);
    }
  });
});
