import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { TestBed } from '@angular/core/testing';
import { TestbedHarnessEnvironment } from '@angular/cdk/testing/testbed';
import { MatSlideToggleHarness } from '@angular/material/slide-toggle/testing';
import { MatSnackBar } from '@angular/material/snack-bar';
import { provideRouter } from '@angular/router';

import type { Zap } from '@workflow/shared';

import { buildZap } from '../../../../testing/fixtures';
import { ZapListPage } from './zap-list.page';

const ERROR = { error: { code: 'internal_error', message: 'Something went wrong' } };

async function setup() {
  const snackBar = { open: vi.fn() };
  TestBed.configureTestingModule({
    providers: [
      provideRouter([]),
      provideHttpClient(),
      provideHttpClientTesting(),
      { provide: MatSnackBar, useValue: snackBar },
    ],
  });
  const fixture = TestBed.createComponent(ZapListPage);
  const http = TestBed.inject(HttpTestingController);
  const element = fixture.nativeElement as HTMLElement;
  const loader = TestbedHarnessEnvironment.loader(fixture);
  await fixture.whenStable();

  const load = async (zaps: Zap[]) => {
    http.expectOne('/api/zaps').flush(zaps);
    await fixture.whenStable();
  };
  const deleteFirst = () =>
    [...element.querySelectorAll<HTMLButtonElement>('li button')].find((b) => b.textContent?.trim() === 'Delete')!.click();
  return { fixture, http, element, loader, snackBar, load, deleteFirst };
}

describe('ZapListPage', () => {
  afterEach(() => TestBed.inject(HttpTestingController).verify());

  it('shows progress while zaps load', async () => {
    const { element, load } = await setup();

    expect(element.querySelector('mat-progress-bar')).not.toBeNull();
    await load([]);
    expect(element.querySelector('mat-progress-bar')).toBeNull();
  });

  it('invites the user to create a first zap when there are none', async () => {
    const { element, load } = await setup();

    await load([]);

    expect(element.querySelector('h1')?.textContent).toBe('Create your first Zap');
    expect(element.querySelector('a[href="/zaps/new"]')).not.toBeNull();
  });

  it('lists zaps with a readable trigger and action summary', async () => {
    const { element, load } = await setup();

    await load([buildZap(), buildZap({ id: 'zap-2', name: 'Second', enabled: false })]);

    const rows = [...element.querySelectorAll('li')];
    expect(rows).toHaveLength(2);
    expect(rows[0]?.querySelector('strong')?.textContent).toBe('Thank contributors');
    expect(rows[0]?.textContent?.replace(/\s+/g, ' ')).toContain(
      'Pull request opened in acme/app → Comment on pull request',
    );
    expect(rows[1]?.querySelector('a.details')?.getAttribute('href')).toBe('/zaps/zap-2');
  });

  it('reports a load failure', async () => {
    const { http, fixture, snackBar } = await setup();

    http.expectOne('/api/zaps').flush(ERROR, { status: 500, statusText: 'Server Error' });
    await fixture.whenStable();

    expect(snackBar.open).toHaveBeenCalledWith('Something went wrong', 'Dismiss', { duration: 5000 });
  });

  it('turns a zap off and keeps the server response', async () => {
    const { http, loader, load } = await setup();
    await load([buildZap()]);
    const toggle = await loader.getHarness(MatSlideToggleHarness);

    await toggle.toggle();
    const request = http.expectOne('/api/zaps/zap-1');
    expect(request.request.method).toBe('PATCH');
    expect(request.request.body).toEqual({ enabled: false });
    request.flush(buildZap({ enabled: false }));

    expect(await toggle.isChecked()).toBe(false);
  });

  it('rolls the toggle back and explains why when the update fails', async () => {
    const { http, loader, load, snackBar } = await setup();
    await load([buildZap()]);
    const toggle = await loader.getHarness(MatSlideToggleHarness);

    await toggle.toggle();
    http
      .expectOne('/api/zaps/zap-1')
      .flush({ error: { code: 'forbidden', message: 'No access' } }, { status: 403, statusText: 'Forbidden' });

    expect(await toggle.isChecked()).toBe(true);
    expect(snackBar.open).toHaveBeenCalledWith('No access', 'Dismiss', { duration: 5000 });
  });

  it('deletes a zap after confirmation', async () => {
    const { http, element, fixture, load, deleteFirst } = await setup();
    vi.spyOn(window, 'confirm').mockReturnValue(true);
    await load([buildZap(), buildZap({ id: 'zap-2', name: 'Keep me' })]);

    deleteFirst();
    const request = http.expectOne('/api/zaps/zap-1');
    expect(request.request.method).toBe('DELETE');
    request.flush(null);
    await fixture.whenStable();

    expect([...element.querySelectorAll('li strong')].map((e) => e.textContent)).toEqual(['Keep me']);
  });

  it('does nothing when deletion is not confirmed', async () => {
    const { element, load, deleteFirst } = await setup();
    vi.spyOn(window, 'confirm').mockReturnValue(false);
    await load([buildZap()]);

    deleteFirst();

    expect(element.querySelectorAll('li')).toHaveLength(1);
  });
});
