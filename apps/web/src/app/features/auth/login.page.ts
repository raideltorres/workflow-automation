import { ChangeDetectionStrategy, Component, computed, inject, input } from '@angular/core';
import { MatButtonModule } from '@angular/material/button';
import { MatCardModule } from '@angular/material/card';

import { AuthService } from '../../core/auth/auth.service';

const ERROR_MESSAGES: Record<string, string> = {
  oauth_failed: 'GitHub sign-in was cancelled or could not be verified. Please try again.',
  sign_in_failed: 'We could not complete sign-in with GitHub. Please try again.',
};

@Component({
  selector: 'app-login-page',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [MatCardModule, MatButtonModule],
  template: `
    <section class="page">
      <mat-card appearance="outlined" class="card">
        <mat-card-header>
          <mat-card-title>Workflow Automation</mat-card-title>
          <mat-card-subtitle>Automate your GitHub pull requests with Zaps</mat-card-subtitle>
        </mat-card-header>
        <mat-card-content>
          @if (errorMessage(); as message) {
            <p class="error" role="alert">{{ message }}</p>
          }
        </mat-card-content>
        <mat-card-actions>
          <button mat-flat-button type="button" (click)="auth.signIn()">Sign in with GitHub</button>
        </mat-card-actions>
      </mat-card>
    </section>
  `,
  styles: `
    .page { min-height: 100vh; display: grid; place-items: center; padding: 24px; }
    .card { width: 100%; max-width: 420px; }
    .error { color: var(--mat-sys-error); }
    mat-card-actions { padding: 16px; }
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
