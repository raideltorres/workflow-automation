import { HttpErrorResponse, type HttpInterceptorFn, HttpStatusCode } from '@angular/common/http';
import { inject } from '@angular/core';
import { Router } from '@angular/router';
import { catchError, throwError } from 'rxjs';

import { AuthService } from './auth.service';

const SESSION_PROBE_URL = '/api/auth/me';

export const unauthorizedInterceptor: HttpInterceptorFn = (req, next) => {
  const auth = inject(AuthService);
  const router = inject(Router);

  return next(req).pipe(
    catchError((error: unknown) => {
      if (
        error instanceof HttpErrorResponse &&
        error.status === HttpStatusCode.Unauthorized &&
        req.url !== SESSION_PROBE_URL
      ) {
        auth.clear();
        void router.navigate(['/login']);
      }
      return throwError(() => error);
    }),
  );
};
