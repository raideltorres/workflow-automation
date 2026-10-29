import { ChangeDetectionStrategy, Component, inject } from '@angular/core';
import { MatButtonModule } from '@angular/material/button';
import { MatToolbarModule } from '@angular/material/toolbar';
import { Router, RouterLink, RouterOutlet } from '@angular/router';

import { AuthService } from '../auth/auth.service';

@Component({
  selector: 'app-shell',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [RouterOutlet, RouterLink, MatToolbarModule, MatButtonModule],
  template: `
    <mat-toolbar class="toolbar">
      <a routerLink="/zaps" class="brand">Workflow Automation</a>
      <span class="spacer"></span>
      @if (auth.user(); as user) {
        <img class="avatar" [src]="user.avatarUrl" [alt]="user.login" />
        <span class="login">{{ user.login }}</span>
      }
      <button mat-button type="button" (click)="signOut()">Sign out</button>
    </mat-toolbar>
    <main class="content">
      <router-outlet />
    </main>
  `,
  styleUrl: './shell.component.scss',
})
export class ShellComponent {
  protected readonly auth = inject(AuthService);
  private readonly router = inject(Router);

  protected async signOut(): Promise<void> {
    await this.auth.signOut();
    await this.router.navigate(['/login']);
  }
}
