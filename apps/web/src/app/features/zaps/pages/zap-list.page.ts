import { ChangeDetectionStrategy, Component, inject, signal } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { MatButtonModule } from '@angular/material/button';
import { MatCardModule } from '@angular/material/card';
import { MatIconModule } from '@angular/material/icon';
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
  imports: [RouterLink, MatButtonModule, MatCardModule, MatIconModule, MatSlideToggleModule, MatProgressBarModule],
  template: `
    @if (loading()) {
      <mat-progress-bar mode="indeterminate" />
    } @else if (zaps().length === 0) {
      <section class="empty">
        <span class="logo" aria-hidden="true">
          <mat-icon fontSet="material-symbols-outlined">bolt</mat-icon>
        </span>
        <h1>Create your first Zap</h1>
        <p class="lead">A trigger listens for an event. An action runs the moment it happens.</p>

        <div class="flow" aria-label="Example Zap: when a pull request is opened, comment on it">
          <div class="step">
            <mat-icon fontSet="material-symbols-outlined" aria-hidden="true">merge</mat-icon>
            <span>Pull request opened</span>
          </div>
          <mat-icon class="arrow" fontSet="material-symbols-outlined" aria-hidden="true">arrow_forward</mat-icon>
          <div class="step">
            <mat-icon fontSet="material-symbols-outlined" aria-hidden="true">chat_bubble</mat-icon>
            <span>Comment on it</span>
          </div>
        </div>

        <a mat-flat-button routerLink="/zaps/new">Create Zap</a>
      </section>
    } @else {
      <header class="header">
        <div>
          <h1>Zaps</h1>
          <p class="muted">A trigger and an action. Toggle a Zap on to start listening.</p>
        </div>
        <a mat-flat-button routerLink="/zaps/new">Create Zap</a>
      </header>

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

    .empty {
      min-height: calc(100dvh - 160px);
      max-width: 480px;
      margin: 0 auto;
      display: flex;
      flex-direction: column;
      align-items: center;
      justify-content: center;
      text-align: center;
    }
    .logo {
      display: grid;
      place-items: center;
      width: 48px;
      height: 48px;
      margin-bottom: 20px;
      border-radius: 14px;
      background: var(--mat-sys-primary);
      color: var(--mat-sys-on-primary);
    }
    .empty h1 { margin: 0 0 8px; font-size: 28px; font-weight: 500; letter-spacing: -0.01em; }
    .lead { margin: 0 0 28px; font-size: 15px; line-height: 1.5; color: var(--mat-sys-on-surface-variant); }
    .flow {
      display: flex;
      align-items: center;
      gap: 8px;
      width: 100%;
      padding: 12px;
      margin-bottom: 28px;
      border-radius: 12px;
      background: var(--mat-sys-surface-container);
      text-align: left;
    }
    .step {
      flex: 1;
      display: flex;
      align-items: center;
      gap: 8px;
      min-width: 0;
      padding: 8px 10px;
      border-radius: 8px;
      background: var(--mat-sys-surface);
      font-size: 13px;
      font-weight: 500;
      white-space: nowrap;
    }
    .step mat-icon, .arrow { flex: none; font-size: 18px; width: 18px; height: 18px; }
    .step mat-icon { color: var(--mat-sys-primary); }
    .arrow { color: var(--mat-sys-outline); }

    @media (max-width: 480px) {
      .flow { flex-direction: column; align-items: stretch; }
      .arrow { align-self: center; transform: rotate(90deg); }
    }
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
