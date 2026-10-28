import { TestBed } from '@angular/core/testing';
import {
  type ActivatedRouteSnapshot,
  type CanActivateFn,
  Router,
  type RouterStateSnapshot,
  UrlTree,
  provideRouter,
} from '@angular/router';

import type { CurrentUser } from '@workflow/shared';

import { buildUser } from '../../../testing/fixtures';
import { authGuard, guestGuard } from './auth.guards';
import { AuthService } from './auth.service';

function setup(user: CurrentUser | null) {
  TestBed.configureTestingModule({
    providers: [provideRouter([]), { provide: AuthService, useValue: { ensureLoaded: vi.fn().mockResolvedValue(user) } }],
  });
  const router = TestBed.inject(Router);
  // The guard's synchronous part runs in the injection context; anything after its await does not.
  const run = (guard: CanActivateFn) =>
    TestBed.runInInjectionContext(() => guard({} as ActivatedRouteSnapshot, {} as RouterStateSnapshot)) as Promise<
      boolean | UrlTree
    >;
  const target = (result: boolean | UrlTree) => (result instanceof UrlTree ? router.serializeUrl(result) : result);
  return { run, target };
}

describe('authGuard', () => {
  it('lets signed-in users through', async () => {
    const { run, target } = setup(buildUser());

    expect(target(await run(authGuard))).toBe(true);
  });

  it('redirects signed-out visitors to the login page', async () => {
    const { run, target } = setup(null);

    expect(target(await run(authGuard))).toBe('/login');
  });
});

describe('guestGuard', () => {
  it('shows the login page to signed-out visitors', async () => {
    const { run, target } = setup(null);

    expect(target(await run(guestGuard))).toBe(true);
  });

  it('sends signed-in users to their zaps', async () => {
    const { run, target } = setup(buildUser());

    expect(target(await run(guestGuard))).toBe('/zaps');
  });
});
