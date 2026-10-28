import type { Routes } from '@angular/router';

import { authGuard, guestGuard } from './core/auth/auth.guards';
import { ShellComponent } from './core/layout/shell.component';

export const routes: Routes = [
  {
    path: 'login',
    canActivate: [guestGuard],
    loadComponent: () => import('./features/auth/login.page').then((m) => m.LoginPage),
  },
  {
    path: '',
    component: ShellComponent,
    canActivate: [authGuard],
    children: [
      { path: '', pathMatch: 'full', redirectTo: 'zaps' },
      { path: 'zaps', loadChildren: () => import('./features/zaps/zaps.routes').then((m) => m.ZAPS_ROUTES) },
    ],
  },
  { path: '**', redirectTo: '' },
];
