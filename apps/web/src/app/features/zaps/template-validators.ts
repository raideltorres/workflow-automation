import type { ValidatorFn } from '@angular/forms';

import { type OutputField, findUnknownTemplateTokens } from '@workflow/shared';

export interface UnknownTokensError {
  readonly unknownTokens: readonly string[];
}

export function knownTemplateTokensValidator(fields: () => readonly OutputField[]): ValidatorFn {
  return (control) => {
    const value: unknown = control.value;
    if (typeof value !== 'string') return null;
    const unknown = findUnknownTemplateTokens(
      value,
      fields().map((field) => field.key),
    );
    return unknown.length > 0 ? ({ unknownTokens: unknown } satisfies UnknownTokensError) : null;
  };
}
