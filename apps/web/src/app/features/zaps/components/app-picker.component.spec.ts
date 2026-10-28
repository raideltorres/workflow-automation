import { TestBed } from '@angular/core/testing';

import { APPS, type AppDefinition } from '@workflow/shared';

import { AppPickerComponent } from './app-picker.component';

const apps: AppDefinition[] = [
  { id: 'github', name: 'GitHub', description: 'PRs', status: 'available' },
  { id: 'gitlab', name: 'GitLab', description: 'MRs', status: 'available' },
  { id: 'slack', name: 'Slack', description: 'Chat', status: 'coming_soon' },
];

async function setup(list: readonly AppDefinition[] = apps) {
  const fixture = TestBed.createComponent(AppPickerComponent);
  fixture.componentRef.setInput('apps', list);
  fixture.componentRef.setInput('selected', 'github');
  fixture.componentRef.setInput('label', 'Trigger app');
  await fixture.whenStable();
  const element = fixture.nativeElement as HTMLElement;
  const tile = (name: string) =>
    [...element.querySelectorAll<HTMLButtonElement>('button[role="radio"]')].find((b) => b.textContent?.includes(name))!;
  return { fixture, element, tile };
}

describe('AppPickerComponent', () => {
  it('renders an accessible radio group with the selected app checked', async () => {
    const { element, tile } = await setup();

    expect(element.querySelector('[role="radiogroup"]')?.getAttribute('aria-label')).toBe('Trigger app');
    expect(tile('GitHub').getAttribute('aria-checked')).toBe('true');
    expect(tile('GitLab').getAttribute('aria-checked')).toBe('false');
  });

  it('selects another available app', async () => {
    const { fixture, tile } = await setup();

    tile('GitLab').click();
    await fixture.whenStable();

    expect(fixture.componentInstance.selected()).toBe('gitlab');
    expect(tile('GitLab').getAttribute('aria-checked')).toBe('true');
  });

  it('marks coming-soon apps as unavailable and not selectable', async () => {
    const { fixture, tile } = await setup();

    expect(tile('Slack').disabled).toBe(true);
    expect(tile('Slack').textContent).toContain('Coming soon');
    tile('Slack').click();
    await fixture.whenStable();
    expect(fixture.componentInstance.selected()).toBe('github');
  });

  it('only lets GitHub be picked from the real catalog', async () => {
    const { element } = await setup(APPS);

    const enabled = [...element.querySelectorAll<HTMLButtonElement>('button[role="radio"]:not(:disabled)')];
    expect(enabled.map((b) => b.querySelector('.name')?.textContent)).toEqual(['GitHub']);
    expect(element.querySelectorAll('.badge')).toHaveLength(APPS.length - 1);
  });
});
