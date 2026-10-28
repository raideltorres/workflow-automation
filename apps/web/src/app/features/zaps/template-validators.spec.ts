import { FormControl } from '@angular/forms';

import { knownTemplateTokensValidator } from './template-validators';

const fields = [{ key: 'pull_request.title', label: 'PR title', example: 'Fix' }];

describe('knownTemplateTokensValidator', () => {
  const validator = knownTemplateTokensValidator(() => fields);

  it('accepts templates that only use available fields', () => {
    expect(validator(new FormControl('PR: {{pull_request.title}}'))).toBeNull();
  });

  it('reports unknown fields', () => {
    expect(validator(new FormControl('{{pull_request.title}} {{nope}}'))).toEqual({ unknownTokens: ['nope'] });
  });
});
