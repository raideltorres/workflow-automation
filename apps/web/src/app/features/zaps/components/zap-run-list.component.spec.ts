import { TestBed } from '@angular/core/testing';

import type { ZapRun } from '@workflow/shared';

import { buildRun } from '../../../../testing/fixtures';
import { ZapRunListComponent } from './zap-run-list.component';

async function render(runs: readonly ZapRun[]) {
  const fixture = TestBed.createComponent(ZapRunListComponent);
  fixture.componentRef.setInput('runs', runs);
  await fixture.whenStable();
  return fixture.nativeElement as HTMLElement;
}

describe('ZapRunListComponent', () => {
  it('explains how to trigger the first run', async () => {
    const element = await render([]);

    expect(element.textContent).toContain('No runs yet');
    expect(element.querySelector('table')).toBeNull();
  });

  it('shows the pull request and a link to the posted comment for a successful run', async () => {
    const element = await render([buildRun()]);
    const row = element.querySelector('tbody tr') as HTMLElement;
    const [prLink, commentLink] = [...row.querySelectorAll('a')];

    expect(row.querySelector('.status')?.textContent).toBe('succeeded');
    expect(row.querySelector('.status')?.getAttribute('data-status')).toBe('succeeded');
    expect(prLink?.textContent?.trim()).toBe('#42 Add login');
    expect(prLink?.getAttribute('href')).toBe('https://github.com/acme/app/pull/42');
    expect(commentLink?.textContent).toBe('View comment');
    expect(commentLink?.getAttribute('href')).toBe('https://github.com/acme/app/pull/42#issuecomment-1');
    expect(commentLink?.getAttribute('rel')).toBe('noopener');
  });

  it('shows the error for a failed run', async () => {
    const element = await render([
      buildRun({ id: 'run-2', status: 'failed', output: undefined, error: 'Resource not accessible by integration' }),
    ]);

    expect(element.querySelector('.status')?.textContent).toBe('failed');
    expect(element.querySelector('.error')?.textContent).toBe('Resource not accessible by integration');
    expect(element.textContent).not.toContain('View comment');
  });

  it('renders one row per run', async () => {
    const element = await render([buildRun(), buildRun({ id: 'run-2', status: 'running', output: undefined })]);

    expect(element.querySelectorAll('tbody tr')).toHaveLength(2);
  });
});
