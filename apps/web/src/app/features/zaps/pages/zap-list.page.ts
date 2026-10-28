import { ChangeDetectionStrategy, Component, inject, signal } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { MatButtonModule } from '@angular/material/button';
import { MatCardModule } from '@angular/material/card';
import { MatProgressBarModule } from '@angular/material/progress-bar';
import { MatSlideToggleModule } from '@angular/material/slide-toggle';
import { MatSnackBar } from '@angular/material/snack-bar';
import { RouterLink } from '@angular/router';

import type { Zap } from '@workflow/shared';

import { toErrorMessage } from '../../../shared/http-error';
import { ZapsApiService } from '../data/zaps-api.service';
import { actionName, triggerName } from '../zap-labels';

@Component({
  selector: 'app-zap-list-page',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [RouterLink, MatButtonModule, MatCardModule, MatSlideToggleModule, MatProgressBarModule],
  template: `
    <header class="header">
      <div>
        <h1>Zaps</h1>
        <p class="muted">A trigger and an action. Toggle a Zap on to start listening.</p>
      </div>
      <a mat-flat-button routerLink="/zaps/new">Create Zap</a>
    </header>

    @if (loading()) {
      <mat-progress-bar mode="indeterminate" />
    } @else if (zaps().length === 0) {
      <mat-card appearance="outlined" class="empty">
        <mat-card-content>
          <p>You have no Zaps yet.</p>
          <a mat-stroked-button routerLink="/zaps/new">Create your first Zap</a>
        </mat-card-content>
      </mat-card>
    } @else {
      <ul class="list">
        @for (zap of zaps(); track zap.id) {
          <li>
            <mat-card appearance="outlined">
              <mat-card-content class="row">
                <mat-slide-toggle
                  [checked]="zap.enabled"
                  (change)="toggle(zap, $event.checked)"
                  [aria-label]="'Enable ' + zap.name"
                />
                <a class="details" [routerLink]="['/zaps', zap.id]">
                  <strong>{{ zap.name }}</strong>
                  <span class="muted">
                    {{ triggerName(zap.trigger.key) }} in {{ zap.trigger.config.repositoryFullName }} →
                    {{ actionName(zap.action.key) }}
                  </span>
                </a>
                <button mat-button type="button" (click)="remove(zap)">Delete</button>
              </mat-card-content>
            </mat-card>
          </li>
        }
      </ul>
    }
  `,
  styles: `
    .header { display: flex; align-items: center; justify-content: space-between; gap: 16px; margin-bottom: 16px; }
    h1 { margin: 0; font-size: 24px; }
    .muted { color: var(--mat-sys-on-surface-variant); margin: 4px 0 0; font-size: 14px; }
    .list { list-style: none; padding: 0; margin: 0; display: grid; gap: 12px; }
    .row { display: flex; align-items: center; gap: 16px; }
    .details { flex: 1; display: flex; flex-direction: column; color: inherit; text-decoration: none; }
    .empty mat-card-content { display: flex; flex-direction: column; align-items: flex-start; gap: 8px; }
  `,
})
export class ZapListPage {
  private readonly api = inject(ZapsApiService);
  private readonly snackBar = inject(MatSnackBar);

  protected readonly zaps = signal<Zap[]>([]);
  protected readonly loading = signal(true);
  protected readonly triggerName = triggerName;
  protected readonly actionName = actionName;

  constructor() {
    this.api
      .list()
      .pipe(takeUntilDestroyed())
      .subscribe({
        next: (zaps) => {
          this.zaps.set(zaps);
          this.loading.set(false);
        },
        error: (error: unknown) => {
          this.loading.set(false);
          this.notify(toErrorMessage(error, 'Could not load Zaps'));
        },
      });
  }

  protected toggle(zap: Zap, enabled: boolean): void {
    this.replace({ ...zap, enabled });
    this.api.update(zap.id, { enabled }).subscribe({
      next: (updated) => this.replace(updated),
      error: (error: unknown) => {
        this.replace(zap);
        this.notify(toErrorMessage(error, 'Could not update Zap'));
      },
    });
  }

  protected remove(zap: Zap): void {
    if (!confirm(`Delete "${zap.name}"?`)) return;
    this.api.delete(zap.id).subscribe({
      next: () => this.zaps.update((zaps) => zaps.filter((z) => z.id !== zap.id)),
      error: (error: unknown) => this.notify(toErrorMessage(error, 'Could not delete Zap')),
    });
  }

  private replace(zap: Zap): void {
    this.zaps.update((zaps) => zaps.map((z) => (z.id === zap.id ? zap : z)));
  }

  private notify(message: string): void {
    this.snackBar.open(message, 'Dismiss', { duration: 5000 });
  }
}
