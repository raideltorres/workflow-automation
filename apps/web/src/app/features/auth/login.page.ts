import { ChangeDetectionStrategy, Component, computed, inject, input } from '@angular/core';
import { MatButtonModule } from '@angular/material/button';
import { MatIconModule } from '@angular/material/icon';

import { AuthService } from '../../core/auth/auth.service';

const ERROR_MESSAGES: Record<string, string> = {
  oauth_failed: 'GitHub sign-in was cancelled or could not be verified. Please try again.',
  sign_in_failed: 'We could not complete sign-in with GitHub. Please try again.',
};

@Component({
  selector: 'app-login-page',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [MatButtonModule, MatIconModule],
  template: `
    <main class="page">
      <section class="panel" aria-labelledby="login-title">
        <div class="brand">
          <span class="logo" aria-hidden="true">
            <mat-icon fontSet="material-symbols-outlined">bolt</mat-icon>
          </span>
          <span class="brand-name">Workflow Automation</span>
        </div>

        <h1 id="login-title">Automate your pull requests</h1>
        <p class="lead">Connect a GitHub trigger to an action. Your Zap runs the moment a pull request opens.</p>

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

        @if (errorMessage(); as message) {
          <p class="error" role="alert">
            <mat-icon fontSet="material-symbols-outlined" aria-hidden="true">error</mat-icon>
            {{ message }}
          </p>
        }

        <button mat-flat-button class="github" type="button" (click)="auth.signIn()">
          <svg class="github-mark" viewBox="0 0 16 16" aria-hidden="true">
            <path
              d="M8 0C3.58 0 0 3.58 0 8c0 3.54 2.29 6.53 5.47 7.59.4.07.55-.17.55-.38 0-.19-.01-.82-.01-1.49-2.01.37-2.53-.49-2.69-.94-.09-.23-.48-.94-.82-1.13-.28-.15-.68-.52-.01-.53.63-.01 1.08.58 1.23.82.72 1.21 1.87.87 2.33.66.07-.52.28-.87.51-1.07-1.78-.2-3.64-.89-3.64-3.95 0-.87.31-1.59.82-2.15-.08-.2-.36-1.02.08-2.12 0 0 .67-.21 2.2.82.64-.18 1.32-.27 2-.27.68 0 1.36.09 2 .27 1.53-1.04 2.2-.82 2.2-.82.44 1.1.16 1.92.08 2.12.51.56.82 1.27.82 2.15 0 3.07-1.87 3.75-3.65 3.95.29.25.54.73.54 1.48 0 1.07-.01 1.93-.01 2.2 0 .21.15.46.55.38A8.013 8.013 0 0016 8c0-4.42-3.58-8-8-8z"
            />
          </svg>
          Continue with GitHub
        </button>

        <p class="fine-print">You pick which repositories the app can access.</p>
      </section>
    </main>
  `,
  styles: `
    .page {
      min-height: 100dvh;
      display: grid;
      place-items: center;
      padding: 24px;
      background:
        radial-gradient(circle at 20% 0%, color-mix(in srgb, var(--mat-sys-primary) 12%, transparent), transparent 45%),
        radial-gradient(circle at 100% 100%, color-mix(in srgb, var(--mat-sys-tertiary) 10%, transparent), transparent 40%),
        var(--mat-sys-surface-container-lowest);
    }

    .panel {
      width: 100%;
      max-width: 480px;
      padding: 40px 36px 32px;
      border-radius: 20px;
      background: var(--mat-sys-surface);
      border: 1px solid var(--mat-sys-outline-variant);
      box-shadow: 0 12px 40px -12px color-mix(in srgb, var(--mat-sys-shadow) 18%, transparent);
    }

    .brand { display: flex; align-items: center; gap: 10px; margin-bottom: 32px; }
    .logo {
      display: grid;
      place-items: center;
      width: 36px;
      height: 36px;
      border-radius: 10px;
      background: var(--mat-sys-primary);
      color: var(--mat-sys-on-primary);
    }
    .brand-name { font-weight: 500; font-size: 15px; color: var(--mat-sys-on-surface-variant); }

    h1 { margin: 0 0 8px; font-size: 28px; line-height: 1.2; font-weight: 500; letter-spacing: -0.01em; }
    .lead { margin: 0 0 28px; font-size: 15px; line-height: 1.5; color: var(--mat-sys-on-surface-variant); }

    .flow {
      display: flex;
      align-items: center;
      gap: 8px;
      padding: 12px;
      margin-bottom: 28px;
      border-radius: 12px;
      background: var(--mat-sys-surface-container);
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
    .step mat-icon { flex: none; font-size: 18px; width: 18px; height: 18px; color: var(--mat-sys-primary); }
    .arrow { flex: none; color: var(--mat-sys-outline); }

    .error {
      display: flex;
      align-items: flex-start;
      gap: 8px;
      margin: 0 0 16px;
      padding: 10px 12px;
      border-radius: 8px;
      font-size: 14px;
      background: var(--mat-sys-error-container);
      color: var(--mat-sys-on-error-container);
    }
    .error mat-icon { flex: none; font-size: 20px; width: 20px; height: 20px; }

    .github {
      width: 100%;
      height: 48px;
      font-size: 15px;
      --mat-button-filled-container-color: #24292f;
      --mat-button-filled-label-text-color: #ffffff;
      --mat-button-filled-container-shape: 10px;
    }
    .github-mark { width: 20px; height: 20px; margin-right: 8px; fill: currentColor; vertical-align: middle; }

    .fine-print { margin: 16px 0 0; font-size: 12px; text-align: center; color: var(--mat-sys-on-surface-variant); }

    @media (max-width: 480px) {
      .panel { padding: 28px 20px 24px; }
      .flow { flex-direction: column; align-items: stretch; }
      .arrow { align-self: center; transform: rotate(90deg); }
    }
  `,
})
export class LoginPage {
  protected readonly auth = inject(AuthService);
  readonly error = input<string>();

  protected readonly errorMessage = computed(() => {
    const code = this.error();
    return code ? (ERROR_MESSAGES[code] ?? 'Sign-in failed.') : null;
  });
}
