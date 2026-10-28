import { TestBed } from '@angular/core/testing';

import { TemplateEditorComponent } from './template-editor.component';

const fields = [
  { key: 'pull_request.author', label: 'PR author', example: 'octocat' },
  { key: 'pull_request.title', label: 'PR title', example: 'Add login' },
];

async function setup(initial: string) {
  const fixture = TestBed.createComponent(TemplateEditorComponent);
  fixture.componentRef.setInput('fields', fields);
  const onChange = vi.fn();
  fixture.componentInstance.registerOnChange(onChange);
  fixture.componentInstance.writeValue(initial);
  await fixture.whenStable();
  const element = fixture.nativeElement as HTMLElement;
  const textarea = element.querySelector('textarea') as HTMLTextAreaElement;
  return { fixture, element, textarea, onChange };
}

describe('TemplateEditorComponent', () => {
  it('inserts the clicked field token at the cursor position', async () => {
    const { fixture, element, textarea, onChange } = await setup('Thanks !');
    textarea.setSelectionRange(7, 7);

    (element.querySelector('mat-chip') as HTMLElement).click();
    await fixture.whenStable();

    expect(onChange).toHaveBeenCalledWith('Thanks {{pull_request.author}}!');
  });

  it('previews the template with sample values', async () => {
    const { element } = await setup('Hi {{pull_request.author}}');

    expect(element.querySelector('.preview')?.textContent).toContain('Hi octocat');
  });
});
