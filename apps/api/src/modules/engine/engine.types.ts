import type { ActionKey, TemplateData, TriggerKey } from '@workflow/shared';

export interface PullRequestContext {
  readonly repositoryFullName: string;
  readonly pullRequestNumber: number;
  readonly pullRequestTitle: string;
  readonly pullRequestUrl: string;
}

/** A normalized trigger occurrence. Every current trigger is pull-request based. */
export interface TriggerEvent {
  readonly key: TriggerKey;
  readonly deliveryId: string;
  readonly installationId: number;
  readonly repositoryId: number;
  readonly pullRequest: PullRequestContext;
  /** Values exposed to templates, keyed by the trigger's declared output fields. */
  readonly data: TemplateData;
}

export interface ActionResult {
  readonly commentUrl: string;
}

export interface ActionHandler {
  readonly key: ActionKey;
  execute(event: TriggerEvent, input: Readonly<Record<string, string>>): Promise<ActionResult>;
}

export interface TriggerNormalizer {
  readonly key: TriggerKey;
  readonly githubEvent: string;
  readonly githubAction: string;
  normalize(payload: unknown, deliveryId: string): TriggerEvent;
}
