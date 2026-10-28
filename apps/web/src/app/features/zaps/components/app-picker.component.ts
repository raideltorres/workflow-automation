import { ChangeDetectionStrategy, Component, input, model } from '@angular/core';

import type { AppDefinition, AppId } from '@workflow/shared';

@Component({
  selector: 'app-app-picker',
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <div class="grid" role="radiogroup" [attr.aria-label]="label()">
      @for (app of apps(); track app.id) {
        <button
          type="button"
          class="tile"
          role="radio"
          [class.selected]="app.id === selected()"
          [attr.aria-checked]="app.id === selected()"
          [disabled]="app.status !== 'available'"
          (click)="selected.set(app.id)"
        >
          <span class="name">{{ app.name }}</span>
          <span class="description">{{ app.description }}</span>
          @if (app.status === 'coming_soon') {
            <span class="badge">Coming soon</span>
          }
        </button>
      }
    </div>
  `,
  styles: `
    .grid { display: grid; grid-template-columns: repeat(auto-fill, minmax(150px, 1fr)); gap: 8px; }
    .tile {
      display: flex; flex-direction: column; align-items: flex-start; gap: 4px; padding: 12px;
      border: 1px solid var(--mat-sys-outline-variant); border-radius: 8px;
      background: var(--mat-sys-surface); color: inherit; text-align: left; cursor: pointer; font: inherit;
    }
    .tile.selected { border-color: var(--mat-sys-primary); background: var(--mat-sys-primary-container); }
    .tile:disabled { cursor: not-allowed; opacity: 0.55; }
    .name { font-weight: 500; }
    .description { font-size: 12px; color: var(--mat-sys-on-surface-variant); }
    .badge { font-size: 11px; padding: 2px 6px; border-radius: 4px; background: var(--mat-sys-surface-container-high); }
  `,
})
export class AppPickerComponent {
  readonly apps = input.required<readonly AppDefinition[]>();
  readonly label = input('Choose an app');
  readonly selected = model.required<AppId>();
}
