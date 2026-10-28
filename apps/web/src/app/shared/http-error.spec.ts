import { HttpErrorResponse } from '@angular/common/http';

import { toErrorMessage } from './http-error';

function apiError(error: unknown, status = 400) {
  return new HttpErrorResponse({ status, error });
}

describe('toErrorMessage', () => {
  it('uses the API error message', () => {
    expect(toErrorMessage(apiError({ error: { code: 'forbidden', message: 'No access' } }))).toBe('No access');
  });

  it('appends the first field-level detail', () => {
    const error = apiError({
      error: { code: 'validation_error', message: 'Invalid zap', details: [{ path: 'name', message: 'Name is required' }] },
    });

    expect(toErrorMessage(error)).toBe('Invalid zap: Name is required');
  });

  it('ignores details without a message', () => {
    expect(toErrorMessage(apiError({ error: { code: 'x', message: 'Invalid', details: [{}] } }))).toBe('Invalid');
  });

  it('falls back for network failures and unknown errors', () => {
    expect(toErrorMessage(apiError('Gateway Timeout', 504), 'Could not save')).toBe('Could not save');
    expect(toErrorMessage(new Error('boom'))).toBe('Something went wrong');
  });
});
