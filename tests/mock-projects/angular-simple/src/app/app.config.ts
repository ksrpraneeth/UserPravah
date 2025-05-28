import { ApplicationConfig } from '@angular/core';
import { provideRouter, Routes } from '@angular/router';

import { HomeComponent } from './home.component';
import { AboutComponent } from './about.component';
import { ContactComponent } from './contact.component';
import { DashboardComponent } from './dashboard.component';
import { SettingsComponent } from './settings.component';
import { UserProfileComponent } from './user-profile.component';
import { NotFoundComponent } from './not-found.component';

export const routes: Routes = [
  { path: 'home', redirectTo: '', pathMatch: 'full' },
  { path: '', component: HomeComponent, title: 'Home Page' },
  { path: 'about/:id', component: AboutComponent, title: 'About Page' },
  { path: 'contact', component: ContactComponent, title: 'Contact Page' },
  { path: 'dashboard', component: DashboardComponent, title: 'Dashboard' },
  { path: 'settings', component: SettingsComponent, title: 'Settings' },
  { path: 'users/:id', component: UserProfileComponent, title: 'User Profile' },
  { path: '**', component: NotFoundComponent, title: 'Page Not Found' }
];

export const appConfig: ApplicationConfig = {
  providers: [provideRouter(routes)]
}; 