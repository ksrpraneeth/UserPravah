import { ApplicationConfig } from '@angular/core';
import { provideRouter, Routes } from '@angular/router';

import { HomeComponent } from './home.component';
import { AboutComponent } from './about.component';
import { NotFoundComponent } from './not-found.component';

export const routes: Routes = [
  { path: 'home', redirectTo: '', pathMatch: 'full' },
  { path: '', component: HomeComponent, title: 'Home Page' },
  { path: 'about/:id', component: AboutComponent, title: 'About Page' },
  { path: '**', component: NotFoundComponent, title: 'Page Not Found' }
];

export const appConfig: ApplicationConfig = {
  providers: [provideRouter(routes)]
}; 