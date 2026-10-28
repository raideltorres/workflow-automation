import type { GitHubGateway } from '../../../integrations/github/github.gateway.js';
import type { ActionHandler, ActionResult, TriggerEvent } from '../engine.types.js';

export class CommentOnPullRequestAction implements ActionHandler {
  readonly key = 'github.pull_request.comment' as const;

  constructor(private readonly github: GitHubGateway) {}

  async execute(event: TriggerEvent, input: Readonly<Record<string, string>>): Promise<ActionResult> {
    const body = input['body']?.trim();
    if (!body) throw new Error('Rendered comment is empty');

    const { url } = await this.github.createPullRequestComment({
      installationId: event.installationId,
      repositoryFullName: event.pullRequest.repositoryFullName,
      pullRequestNumber: event.pullRequest.pullRequestNumber,
      body,
    });
    return { commentUrl: url };
  }
}
