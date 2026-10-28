import { HttpErrorResponse } from '@angular/common/http';

import type { ApiErrorBody } from '@workflow/shared';

function isApiErrorBody(value: unknown): value is ApiErrorBody {
  return typeof value === 'object' && value !== null && 'error' in value;
}

export function toErrorMessage(error: unknown, fallback = 'Something went wrong'): string {
  if (error instanceof HttpErrorResponse && isApiErrorBody(error.error)) {
    const { message, details } = error.error.error;
    if (Array.isArray(details) && details.length > 0) {
      const first = details[0] as { message?: string };
      return first.message ? `${message}: ${first.message}` : message;
    }
    return message;
  }
  return fallback;
}
