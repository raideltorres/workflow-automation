import { inject } from '@angular/core';
import { type CanActivateFn, Router } from '@angular/router';

import { AuthService } from './auth.service';

export const authGuard: CanActivateFn = async () => {
  const user = await inject(AuthService).ensureLoaded();
  return user ? true : inject(Router).createUrlTree(['/login']);
};

export const guestGuard: CanActivateFn = async () => {
  const user = await inject(AuthService).ensureLoaded();
  return user ? inject(Router).createUrlTree(['/zaps']) : true;
};
