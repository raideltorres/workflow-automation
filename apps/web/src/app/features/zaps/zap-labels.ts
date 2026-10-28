import { ACTIONS, APPS, TRIGGERS, type ActionKey, type AppId, type TriggerKey } from '@workflow/shared';

export function appName(id: AppId): string {
  return APPS.find((app) => app.id === id)?.name ?? id;
}

export function triggerName(key: TriggerKey): string {
  return TRIGGERS.find((t) => t.key === key)?.name ?? key;
}

export function actionName(key: ActionKey): string {
  return ACTIONS.find((a) => a.key === key)?.name ?? key;
}
