import type { Routes } from '@angular/router';

export const ZAPS_ROUTES: Routes = [
  { path: '', loadComponent: () => import('./pages/zap-list.page').then((m) => m.ZapListPage) },
  { path: 'new', loadComponent: () => import('./pages/zap-editor.page').then((m) => m.ZapEditorPage) },
  { path: ':id', loadComponent: () => import('./pages/zap-editor.page').then((m) => m.ZapEditorPage) },
];
