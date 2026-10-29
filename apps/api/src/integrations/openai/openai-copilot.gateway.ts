import { CopilotZapDraftSchema, type CopilotZapDraft } from '@workflow/shared';

import { ExternalServiceError } from '../../core/errors.js';
import type { CopilotGateway } from './copilot.gateway.js';

const OPENAI_RESPONSES_URL = 'https://api.openai.com/v1/responses';

const DRAFT_RESPONSE_SCHEMA = {
  type: 'object',
  additionalProperties: false,
  required: ['name', 'comment'],
  properties: {
    name: { type: 'string', minLength: 1, maxLength: 100 },
    comment: { type: 'string', minLength: 1, maxLength: 65_536 },
  },
} as const;

const SYSTEM_INSTRUCTIONS = `You draft exactly one GitHub automation:
- trigger: a pull request is opened
- action: comment on that pull request

Return a concise Zap name and a comment template only. The template can use only:
{{pull_request.number}}, {{pull_request.title}}, {{pull_request.body}}, {{pull_request.url}},
{{pull_request.author}}, {{pull_request.head_branch}}, {{pull_request.base_branch}},
{{repository.full_name}}.

Do not include markdown fences, explanations, repository names, credentials, unsupported actions, or other fields.`;

interface OpenAiResponse {
  readonly output_text?: string;
  readonly output?: readonly {
    readonly content?: readonly { readonly type?: string; readonly text?: string }[];
  }[];
}

function extractOutputText(response: OpenAiResponse): string | undefined {
  if (response.output_text) return response.output_text;
  return response.output
    ?.flatMap((item) => item.content ?? [])
    .find((content) => content.type === 'output_text')?.text;
}

export class OpenAiCopilotGateway implements CopilotGateway {
  constructor(
    private readonly apiKey: string,
    private readonly model: string,
    private readonly request: typeof fetch = fetch,
  ) {}

  async draftZap(prompt: string): Promise<CopilotZapDraft> {
    let response: Response;
    try {
      response = await this.request(OPENAI_RESPONSES_URL, {
        method: 'POST',
        headers: {
          authorization: `Bearer ${this.apiKey}`,
          'content-type': 'application/json',
        },
        body: JSON.stringify({
          model: this.model,
          input: [
            { role: 'system', content: SYSTEM_INSTRUCTIONS },
            { role: 'user', content: prompt },
          ],
          text: {
            format: {
              type: 'json_schema',
              name: 'github_pr_comment_zap_draft',
              strict: true,
              schema: DRAFT_RESPONSE_SCHEMA,
            },
          },
        }),
      });
    } catch (error) {
      throw new ExternalServiceError('OpenAI', 'could not be reached', { cause: error });
    }

    if (!response.ok) {
      throw new ExternalServiceError('OpenAI', `returned ${response.status}`);
    }

    let payload: OpenAiResponse;
    try {
      payload = (await response.json()) as OpenAiResponse;
    } catch (error) {
      throw new ExternalServiceError('OpenAI', 'returned invalid JSON', { cause: error });
    }

    const output = extractOutputText(payload);
    if (!output) throw new ExternalServiceError('OpenAI', 'returned no structured output');

    try {
      return CopilotZapDraftSchema.parse(JSON.parse(output));
    } catch (error) {
      throw new ExternalServiceError('OpenAI', 'returned an invalid Zap draft', { cause: error });
    }
  }
}
