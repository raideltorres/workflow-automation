export const APP_IDS = ['github', 'gitlab', 'slack', 'linear', 'jira', 'sentry'] as const;
export type AppId = (typeof APP_IDS)[number];

export type AppStatus = 'available' | 'coming_soon';

export interface AppDefinition {
  readonly id: AppId;
  readonly name: string;
  readonly description: string;
  readonly status: AppStatus;
}

export const TRIGGER_KEYS = ['github.pull_request.opened'] as const;
export type TriggerKey = (typeof TRIGGER_KEYS)[number];

export const ACTION_KEYS = ['github.pull_request.comment'] as const;
export type ActionKey = (typeof ACTION_KEYS)[number];

export interface OutputField {
  readonly key: string;
  readonly label: string;
  readonly example: string;
}

export interface InputField {
  readonly key: string;
  readonly label: string;
  readonly required: boolean;
  readonly supportsTemplates: boolean;
}

export interface TriggerDefinition {
  readonly key: TriggerKey;
  readonly app: AppId;
  readonly name: string;
  readonly description: string;
  readonly outputFields: readonly OutputField[];
}

export interface ActionDefinition {
  readonly key: ActionKey;
  readonly app: AppId;
  readonly name: string;
  readonly description: string;
  readonly inputFields: readonly InputField[];
}

export const APPS: readonly AppDefinition[] = [
  { id: 'github', name: 'GitHub', description: 'Pull requests, issues and repositories', status: 'available' },
  { id: 'gitlab', name: 'GitLab', description: 'Merge requests and pipelines', status: 'coming_soon' },
  { id: 'slack', name: 'Slack', description: 'Channel messages and alerts', status: 'coming_soon' },
  { id: 'linear', name: 'Linear', description: 'Issues and project tracking', status: 'coming_soon' },
  { id: 'jira', name: 'Jira', description: 'Tickets and sprints', status: 'coming_soon' },
  { id: 'sentry', name: 'Sentry', description: 'Error and performance alerts', status: 'coming_soon' },
];

export const TRIGGERS: readonly TriggerDefinition[] = [
  {
    key: 'github.pull_request.opened',
    app: 'github',
    name: 'Pull request opened',
    description: 'Fires when a pull request is opened in the selected repository.',
    outputFields: [
      { key: 'pull_request.number', label: 'PR number', example: '42' },
      { key: 'pull_request.title', label: 'PR title', example: 'Add login page' },
      { key: 'pull_request.body', label: 'PR description', example: 'This PR adds...' },
      { key: 'pull_request.url', label: 'PR URL', example: 'https://github.com/acme/app/pull/42' },
      { key: 'pull_request.author', label: 'PR author', example: 'octocat' },
      { key: 'pull_request.head_branch', label: 'Source branch', example: 'feat/login' },
      { key: 'pull_request.base_branch', label: 'Target branch', example: 'main' },
      { key: 'repository.full_name', label: 'Repository', example: 'acme/app' },
    ],
  },
];

export const ACTIONS: readonly ActionDefinition[] = [
  {
    key: 'github.pull_request.comment',
    app: 'github',
    name: 'Comment on pull request',
    description: 'Posts a comment on the pull request that triggered the Zap.',
    inputFields: [{ key: 'body', label: 'Comment', required: true, supportsTemplates: true }],
  },
];

export function findTrigger(key: TriggerKey): TriggerDefinition {
  const trigger = TRIGGERS.find((t) => t.key === key);
  if (!trigger) throw new Error(`Unknown trigger: ${key}`);
  return trigger;
}

export function findAction(key: ActionKey): ActionDefinition {
  const action = ACTIONS.find((a) => a.key === key);
  if (!action) throw new Error(`Unknown action: ${key}`);
  return action;
}
