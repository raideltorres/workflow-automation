import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { TestBed } from '@angular/core/testing';
import { TestbedHarnessEnvironment } from '@angular/cdk/testing/testbed';
import { MatInputHarness } from '@angular/material/input/testing';
import { MatSelectHarness } from '@angular/material/select/testing';
import { MatSlideToggleHarness } from '@angular/material/slide-toggle/testing';
import { MatSnackBar } from '@angular/material/snack-bar';
import { Router, provideRouter } from '@angular/router';

import type { RepositoryListResponse, Zap, ZapRun } from '@workflow/shared';

import { buildRepositoryList, buildRun, buildZap } from '../../../../testing/fixtures';
import { ZapEditorPage } from './zap-editor.page';

interface LoadOptions {
  repositories?: RepositoryListResponse;
  zap?: Zap;
  runs?: ZapRun[];
}

async function setup(id?: string) {
  const snackBar = { open: vi.fn() };
  TestBed.configureTestingModule({
    providers: [
      provideRouter([]),
      provideHttpClient(),
      provideHttpClientTesting(),
      { provide: MatSnackBar, useValue: snackBar },
    ],
  });
  const router = TestBed.inject(Router);
  const navigate = vi.spyOn(router, 'navigate').mockResolvedValue(true);
  const fixture = TestBed.createComponent(ZapEditorPage);
  if (id) fixture.componentRef.setInput('id', id);
  const http = TestBed.inject(HttpTestingController);
  const element = fixture.nativeElement as HTMLElement;
  const loader = TestbedHarnessEnvironment.loader(fixture);
  await fixture.whenStable();

  const load = async ({ repositories = buildRepositoryList(), zap = buildZap(), runs = [] }: LoadOptions = {}) => {
    http.expectOne('/api/github/repositories').flush(repositories);
    if (id) {
      http.expectOne(`/api/zaps/${id}`).flush(zap);
      http.expectOne(`/api/zaps/${id}/runs`).flush(runs);
    }
    await fixture.whenStable();
  };
  const nameInput = () => loader.getHarness(MatInputHarness.with({ selector: '[formControlName="name"]' }));
  const select = (label: string) => loader.getHarness(MatSelectHarness.with({ selector: `[formControlName="${label}"]` }));
  const textarea = () => element.querySelector('textarea') as HTMLTextAreaElement;
  const typeBody = async (value: string) => {
    textarea().value = value;
    textarea().dispatchEvent(new Event('input'));
    textarea().dispatchEvent(new Event('blur'));
    await fixture.whenStable();
  };
  const save = async () => {
    (element.querySelector('button[type="submit"]') as HTMLButtonElement).click();
    await fixture.whenStable();
  };
  const formError = () => element.querySelector('.form-error')?.textContent?.trim();
  return { fixture, http, element, loader, snackBar, navigate, load, nameInput, select, typeBody, save, formError };
}

describe('ZapEditorPage', () => {
  afterEach(() => TestBed.inject(HttpTestingController).verify());

  describe('creating a zap', () => {
    it('builds a GitHub PR-opened → comment zap and saves it', async () => {
      const ctx = await setup();
      await ctx.load();

      await (await ctx.nameInput()).setValue('Greet contributors');
      await (await ctx.select('repositoryId')).clickOptions({ text: 'acme/app' });
      await (await ctx.loader.getHarness(MatSlideToggleHarness)).check();
      await ctx.typeBody('Thanks @{{pull_request.author}} for #{{pull_request.number}}');
      await ctx.save();

      const request = ctx.http.expectOne('/api/zaps');
      expect(request.request.method).toBe('POST');
      expect(request.request.body).toEqual({
        name: 'Greet contributors',
        enabled: true,
        trigger: { key: 'github.pull_request.opened', config: { repositoryId: 100 } },
        action: { key: 'github.pull_request.comment', input: { body: 'Thanks @{{pull_request.author}} for #{{pull_request.number}}' } },
      });
      request.flush(buildZap({ id: 'zap-new' }));
      await ctx.fixture.whenStable();

      expect(ctx.snackBar.open).toHaveBeenCalledWith('Zap created', 'Dismiss', { duration: 4000 });
      expect(ctx.navigate).toHaveBeenCalledWith(['/zaps', 'zap-new'], { replaceUrl: true });
    });

    it('offers the PR-opened trigger, the comment action and private repositories', async () => {
      const ctx = await setup();
      await ctx.load();

      expect(await (await ctx.select('triggerKey')).getValueText()).toBe('Pull request opened');
      expect(await (await ctx.select('actionKey')).getValueText()).toBe('Comment on pull request');
      const repository = await ctx.select('repositoryId');
      await repository.open();
      const options = await repository.getOptions();
      expect(await Promise.all(options.map((o) => o.getText()))).toEqual(['acme/app', 'acme/secret (private)']);
    });

    it('starts with a valid default comment and lets the user insert trigger fields', async () => {
      const ctx = await setup();
      await ctx.load();

      expect((ctx.element.querySelector('textarea') as HTMLTextAreaElement).value).toContain('{{pull_request.author}}');
      const chips = [...ctx.element.querySelectorAll('mat-chip')].map((c) => c.textContent?.trim());
      expect(chips).toEqual(expect.arrayContaining(['PR author', 'PR title', 'PR number', 'Repository']));
    });

    it('marks every non-GitHub app as coming soon in both pickers', async () => {
      const ctx = await setup();
      await ctx.load();

      const disabled = [...ctx.element.querySelectorAll<HTMLButtonElement>('button[role="radio"]:disabled')];
      expect(disabled.map((b) => b.querySelector('.name')?.textContent)).toEqual([
        'GitLab', 'Slack', 'Linear', 'Jira', 'Sentry', 'GitLab', 'Slack', 'Linear', 'Jira', 'Sentry',
      ]);
    });

    it('blocks saving until the name and repository are filled in', async () => {
      const ctx = await setup();
      await ctx.load();

      await ctx.save();

      expect(ctx.formError()).toBe('Name is required');
      expect(ctx.element.textContent).toContain('Select a repository');
      ctx.http.expectNone('/api/zaps');
    });

    it('rejects template fields the trigger does not provide, before calling the API', async () => {
      const ctx = await setup();
      await ctx.load();
      await (await ctx.nameInput()).setValue('Leaky');
      await (await ctx.select('repositoryId')).clickOptions({ text: 'acme/app' });

      await ctx.typeBody('Token: {{secrets.github_token}}');
      await ctx.save();

      expect(ctx.element.querySelector('app-template-editor [role="alert"]')?.textContent).toBe(
        'Unknown fields: secrets.github_token',
      );
      expect(ctx.formError()).toBe('Unknown fields: secrets.github_token');
      ctx.http.expectNone('/api/zaps');
    });

    it('requires a comment', async () => {
      const ctx = await setup();
      await ctx.load();

      await ctx.typeBody('');

      expect(ctx.element.querySelector('app-template-editor [role="alert"]')?.textContent).toBe('Comment is required');
    });

    it('shows the server error when saving fails', async () => {
      const ctx = await setup();
      await ctx.load();
      await (await ctx.nameInput()).setValue('Greeter');
      await (await ctx.select('repositoryId')).clickOptions({ text: 'acme/app' });

      await ctx.save();
      ctx.http.expectOne('/api/zaps').flush(
        { error: { code: 'forbidden', message: 'The GitHub App is not installed on this repository for your account' } },
        { status: 403, statusText: 'Forbidden' },
      );
      await ctx.fixture.whenStable();

      expect(ctx.formError()).toBe('The GitHub App is not installed on this repository for your account');
      expect(ctx.navigate).not.toHaveBeenCalled();
    });

    it('explains how to grant access when no repository is available', async () => {
      const ctx = await setup();
      await ctx.load({ repositories: buildRepositoryList({ repositories: [] }) });

      expect(ctx.element.textContent).toContain('The GitHub App is not installed on any repository you can access yet.');
      const install = [...ctx.element.querySelectorAll('a')].find((a) => a.textContent?.includes('Install the GitHub App'));
      expect(install?.getAttribute('href')).toBe('https://github.com/apps/workflow-test/installations/new');
    });

    it('does not show run history for a new zap', async () => {
      const ctx = await setup();
      await ctx.load();

      expect(ctx.element.querySelector('h1')?.textContent).toBe('Create Zap');
      expect(ctx.element.querySelector('app-zap-run-list')).toBeNull();
    });
  });

  describe('editing a zap', () => {
    it('loads the zap into the form and shows its run history', async () => {
      const ctx = await setup('zap-1');
      await ctx.load({ runs: [buildRun()] });

      expect(ctx.element.querySelector('h1')?.textContent).toBe('Edit Zap');
      expect(await (await ctx.nameInput()).getValue()).toBe('Thank contributors');
      expect(await (await ctx.select('repositoryId')).getValueText()).toBe('acme/app');
      expect(await (await ctx.loader.getHarness(MatSlideToggleHarness)).isChecked()).toBe(true);
      expect((ctx.element.querySelector('textarea') as HTMLTextAreaElement).value).toBe('Thanks @{{pull_request.author}}!');
      expect(ctx.element.querySelector('app-zap-run-list tbody tr')?.textContent).toContain('#42 Add login');
    });

    it('saves changes with PATCH and keeps the user on the page', async () => {
      const ctx = await setup('zap-1');
      await ctx.load();

      await (await ctx.nameInput()).setValue('Renamed');
      await (await ctx.loader.getHarness(MatSlideToggleHarness)).uncheck();
      await ctx.save();

      const request = ctx.http.expectOne('/api/zaps/zap-1');
      expect(request.request.method).toBe('PATCH');
      expect(request.request.body).toMatchObject({ name: 'Renamed', enabled: false });
      request.flush(buildZap({ name: 'Renamed', enabled: false }));
      await ctx.fixture.whenStable();

      expect(ctx.snackBar.open).toHaveBeenCalledWith('Zap saved', 'Dismiss', { duration: 4000 });
      expect(ctx.navigate).not.toHaveBeenCalled();
      expect(await (await ctx.nameInput()).getValue()).toBe('Renamed');
    });

    it('refreshes run history on demand', async () => {
      const ctx = await setup('zap-1');
      await ctx.load();
      expect(ctx.element.textContent).toContain('No runs yet');

      const refresh = [...ctx.element.querySelectorAll('button')].find((b) => b.textContent?.includes('Refresh'))!;
      refresh.click();
      ctx.http.expectOne('/api/zaps/zap-1/runs').flush([buildRun({ status: 'failed', output: undefined, error: 'boom' })]);
      await ctx.fixture.whenStable();

      expect(ctx.element.querySelector('app-zap-run-list .error')?.textContent).toBe('boom');
    });

    it('reports a failed run history refresh', async () => {
      const ctx = await setup('zap-1');
      await ctx.load();

      [...ctx.element.querySelectorAll('button')].find((b) => b.textContent?.includes('Refresh'))!.click();
      ctx.http.expectOne('/api/zaps/zap-1/runs').flush(null, { status: 500, statusText: 'Server Error' });
      await ctx.fixture.whenStable();

      expect(ctx.snackBar.open).toHaveBeenCalledWith('Could not load runs', 'Dismiss', { duration: 4000 });
    });

    it("shows an error instead of the form when the zap cannot be loaded (e.g. another user's)", async () => {
      const ctx = await setup('zap-9');

      ctx.http.expectOne('/api/github/repositories').flush(buildRepositoryList());
      ctx.http
        .expectOne('/api/zaps/zap-9')
        .flush({ error: { code: 'not_found', message: 'Zap not found' } }, { status: 404, statusText: 'Not Found' });
      const [runsRequest] = ctx.http.match('/api/zaps/zap-9/runs');
      await ctx.fixture.whenStable();

      expect(runsRequest?.cancelled).toBe(true);

      expect(ctx.formError()).toBe('Zap not found');
      expect(ctx.element.querySelector('mat-progress-bar')).toBeNull();
      expect(ctx.element.querySelector('form')).toBeNull();
    });
  });
});
