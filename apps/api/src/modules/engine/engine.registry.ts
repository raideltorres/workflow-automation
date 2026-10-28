import type { ActionKey } from '@workflow/shared';

import type { ActionHandler, TriggerNormalizer } from './engine.types.js';

export class EngineRegistry {
  private readonly triggers: ReadonlyMap<string, TriggerNormalizer>;
  private readonly actions: ReadonlyMap<ActionKey, ActionHandler>;

  constructor(triggers: readonly TriggerNormalizer[], actions: readonly ActionHandler[]) {
    this.triggers = new Map(triggers.map((t) => [`${t.githubEvent}.${t.githubAction}`, t]));
    this.actions = new Map(actions.map((a) => [a.key, a]));
  }

  findTrigger(githubEvent: string, githubAction: string | undefined): TriggerNormalizer | undefined {
    return githubAction ? this.triggers.get(`${githubEvent}.${githubAction}`) : undefined;
  }

  getAction(key: ActionKey): ActionHandler {
    const action = this.actions.get(key);
    if (!action) throw new Error(`No handler registered for action ${key}`);
    return action;
  }
}
