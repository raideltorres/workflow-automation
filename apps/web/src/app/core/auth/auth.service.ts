import { HttpClient } from '@angular/common/http';
import { Injectable, computed, inject, signal } from '@angular/core';
import { firstValueFrom } from 'rxjs';

import type { CurrentUser } from '@workflow/shared';

export const SIGN_IN_URL = '/api/auth/github/login';

@Injectable({ providedIn: 'root' })
export class AuthService {
  private readonly http = inject(HttpClient);
  private readonly userState = signal<CurrentUser | null>(null);
  private loaded: Promise<CurrentUser | null> | null = null;

  readonly user = this.userState.asReadonly();
  readonly isAuthenticated = computed(() => this.userState() !== null);

  /** Resolves the session once per app load; guards await this. */
  ensureLoaded(): Promise<CurrentUser | null> {
    this.loaded ??= firstValueFrom(this.http.get<CurrentUser>('/api/auth/me')).then(
      (user) => {
        this.userState.set(user);
        return user;
      },
      () => null,
    );
    return this.loaded;
  }

  signIn(): void {
    window.location.assign(SIGN_IN_URL);
  }

  async signOut(): Promise<void> {
    await firstValueFrom(this.http.post<void>('/api/auth/logout', {}));
    this.clear();
  }

  clear(): void {
    this.userState.set(null);
    this.loaded = Promise.resolve(null);
  }
}
