import { HttpClient, provideHttpClient, withInterceptors } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { TestBed } from '@angular/core/testing';
import { Router } from '@angular/router';
import { firstValueFrom } from 'rxjs';

import { AuthService } from './auth.service';
import { unauthorizedInterceptor } from './unauthorized.interceptor';

function setup() {
  const auth = { clear: vi.fn() };
  const router = { navigate: vi.fn().mockResolvedValue(true) };
  TestBed.configureTestingModule({
    providers: [
      provideHttpClient(withInterceptors([unauthorizedInterceptor])),
      provideHttpClientTesting(),
      { provide: AuthService, useValue: auth },
      { provide: Router, useValue: router },
    ],
  });
  return { auth, router, client: TestBed.inject(HttpClient), http: TestBed.inject(HttpTestingController) };
}

describe('unauthorizedInterceptor', () => {
  it('clears the session and redirects to login when an API call returns 401', async () => {
    const { auth, router, client, http } = setup();

    const result = firstValueFrom(client.get('/api/zaps'));
    http.expectOne('/api/zaps').flush(null, { status: 401, statusText: 'Unauthorized' });

    await expect(result).rejects.toMatchObject({ status: 401 });
    expect(auth.clear).toHaveBeenCalledOnce();
    expect(router.navigate).toHaveBeenCalledWith(['/login']);
  });

  it('leaves the session probe to the auth service', async () => {
    const { auth, router, client, http } = setup();

    const result = firstValueFrom(client.get('/api/auth/me'));
    http.expectOne('/api/auth/me').flush(null, { status: 401, statusText: 'Unauthorized' });

    await expect(result).rejects.toMatchObject({ status: 401 });
    expect(auth.clear).not.toHaveBeenCalled();
    expect(router.navigate).not.toHaveBeenCalled();
  });

  it('passes other errors through untouched', async () => {
    const { auth, client, http } = setup();

    const result = firstValueFrom(client.get('/api/zaps'));
    http.expectOne('/api/zaps').flush(null, { status: 500, statusText: 'Server Error' });

    await expect(result).rejects.toMatchObject({ status: 500 });
    expect(auth.clear).not.toHaveBeenCalled();
  });
});
