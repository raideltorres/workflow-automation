import { ChangeDetectionStrategy, Component, computed, input, model } from '@angular/core';
import { MatIconModule } from '@angular/material/icon';

import type { AppDefinition, AppId } from '@workflow/shared';

const APP_ICONS: Record<AppId, string> = {
  github: 'code',
  gitlab: 'account_tree',
  slack: 'forum',
  linear: 'view_kanban',
  jira: 'confirmation_number',
  sentry: 'bug_report',
};

@Component({
  selector: 'app-app-picker',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [MatIconModule],
  templateUrl: './app-picker.component.html',
  styleUrl: './app-picker.component.scss',
})
export class AppPickerComponent {
  readonly apps = input.required<readonly AppDefinition[]>();
  readonly label = input('Choose an app');
  readonly selected = model.required<AppId>();

  protected readonly tiles = computed(() => this.apps().map((app) => ({ ...app, icon: APP_ICONS[app.id] })));
  protected readonly selectedApp = computed(() => this.apps().find((app) => app.id === this.selected()));
}
