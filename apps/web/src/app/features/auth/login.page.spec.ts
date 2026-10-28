import { TestBed } from '@angular/core/testing';

import { AuthService } from '../../core/auth/auth.service';
import { LoginPage } from './login.page';

async function setup(error?: string) {
  const auth = { signIn: vi.fn() };
  TestBed.configureTestingModule({ providers: [{ provide: AuthService, useValue: auth }] });
  const fixture = TestBed.createComponent(LoginPage);
  if (error) fixture.componentRef.setInput('error', error);
  await fixture.whenStable();
  return { auth, element: fixture.nativeElement as HTMLElement };
}

describe('LoginPage', () => {
  it('starts GitHub sign-in from the primary button', async () => {
    const { auth, element } = await setup();

    (element.querySelector('button') as HTMLButtonElement).click();

    expect(element.querySelector('button')?.textContent).toContain('Continue with GitHub');
    expect(auth.signIn).toHaveBeenCalledOnce();
  });

  it('shows no error by default', async () => {
    const { element } = await setup();

    expect(element.querySelector('[role="alert"]')).toBeNull();
  });

  it.each([
    ['oauth_failed', 'GitHub sign-in was cancelled or could not be verified. Please try again.'],
    ['sign_in_failed', 'We could not complete sign-in with GitHub. Please try again.'],
    ['something_else', 'Sign-in failed.'],
  ])('explains the %s error from the callback redirect', async (code, message) => {
    const { element } = await setup(code);

    expect(element.querySelector('[role="alert"]')?.textContent?.trim()).toContain(message);
  });
});
