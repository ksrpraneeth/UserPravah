import { Routes } from '@angular/router';
import { LazyComponent } from './lazy-component';
import { LazyChildComponent } from './lazy-child.component.ts';

export const LAZY_FEATURE_ROUTES: Routes = [
  { path: '', component: LazyComponent, title: 'Lazy Feature Home' },
  { path: 'child-route', component: LazyChildComponent, title: 'Lazy Child' }
]; 