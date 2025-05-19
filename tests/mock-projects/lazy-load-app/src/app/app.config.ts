import { ApplicationConfig } from '@angular/core';
import { provideRouter, Routes, CanActivateFn } from '@angular/router';

import { HomeComponent } from './home.component';

// Mock Guard (not testing its logic, just its presence)
const MockAuthGuard: CanActivateFn = () => true;

export const routes: Routes = [
  { path: '', component: HomeComponent, title: 'Home' },
  {
    path: 'feature',
    loadChildren: () => import('./lazy-feature/lazy-feature.routes').then(m => m.LAZY_FEATURE_ROUTES),
    canActivate: [MockAuthGuard],
    data: { preload: true, title: 'Lazy Feature Section' }
  },
  {
    path: 'detail',
    loadComponent: () => import('./standalone-detail.component').then(m => m.StandaloneDetailComponent),
    title: 'Standalone Detail'
  }
];

export const appConfig: ApplicationConfig = {
  providers: [provideRouter(routes)]
}; 