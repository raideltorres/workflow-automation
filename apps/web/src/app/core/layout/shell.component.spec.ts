import { signal } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { Router, provideRouter } from '@angular/router';

import type { CurrentUser } from '@workflow/shared';

import { buildUser } from '../../../testing/fixtures';
import { AuthService } from '../auth/auth.service';
import { ShellComponent } from './shell.component';

async function setup(user: CurrentUser | null) {
  const auth = { user: signal(user), signOut: vi.fn().mockResolvedValue(undefined) };
  TestBed.configureTestingModule({ providers: [provideRouter([]), { provide: AuthService, useValue: auth }] });
  const navigate = vi.spyOn(TestBed.inject(Router), 'navigate').mockResolvedValue(true);
  const fixture = TestBed.createComponent(ShellComponent);
  await fixture.whenStable();
  return { auth, navigate, fixture, element: fixture.nativeElement as HTMLElement };
}

describe('ShellComponent', () => {
  it('shows the signed-in user', async () => {
    const { element } = await setup(buildUser());

    expect(element.querySelector('.login')?.textContent).toBe('octocat');
    expect(element.querySelector('img.avatar')?.getAttribute('alt')).toBe('octocat');
  });

  it('signs out and returns to the login page', async () => {
    const { auth, navigate, element, fixture } = await setup(buildUser());

    [...element.querySelectorAll('button')].find((b) => b.textContent?.includes('Sign out'))!.click();
    await fixture.whenStable();

    expect(auth.signOut).toHaveBeenCalledOnce();
    expect(navigate).toHaveBeenCalledWith(['/login']);
  });

  it('renders no user details while the session is unknown', async () => {
    const { element } = await setup(null);

    expect(element.querySelector('.login')).toBeNull();
  });
});
