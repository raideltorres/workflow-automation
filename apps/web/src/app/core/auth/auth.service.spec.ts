import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { TestBed } from '@angular/core/testing';

import { buildUser } from '../../../testing/fixtures';
import { AuthService } from './auth.service';

function setup() {
  TestBed.configureTestingModule({ providers: [provideHttpClient(), provideHttpClientTesting()] });
  return { auth: TestBed.inject(AuthService), http: TestBed.inject(HttpTestingController) };
}

describe('AuthService', () => {
  afterEach(() => TestBed.inject(HttpTestingController).verify());

  it('loads the session once and exposes the user as signals', async () => {
    const { auth, http } = setup();

    const first = auth.ensureLoaded();
    const second = auth.ensureLoaded();
    http.expectOne('/api/auth/me').flush(buildUser());

    expect(await first).toEqual(buildUser());
    expect(await second).toEqual(buildUser());
    expect(auth.user()?.login).toBe('octocat');
    expect(auth.isAuthenticated()).toBe(true);
  });

  it('treats a 401 as signed out instead of failing', async () => {
    const { auth, http } = setup();

    const loaded = auth.ensureLoaded();
    http.expectOne('/api/auth/me').flush({ error: { code: 'unauthorized' } }, { status: 401, statusText: 'Unauthorized' });

    expect(await loaded).toBeNull();
    expect(auth.isAuthenticated()).toBe(false);
  });

  it('signs out on the server and forgets the user without re-probing', async () => {
    const { auth, http } = setup();
    const loaded = auth.ensureLoaded();
    http.expectOne('/api/auth/me').flush(buildUser());
    await loaded;

    const signedOut = auth.signOut();
    const logout = http.expectOne('/api/auth/logout');
    expect(logout.request.method).toBe('POST');
    logout.flush(null, { status: 204, statusText: 'No Content' });
    await signedOut;

    expect(auth.user()).toBeNull();
    expect(await auth.ensureLoaded()).toBeNull();
  });
});
