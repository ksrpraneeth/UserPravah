import { Component } from '@angular/core';
import { RouterOutlet, RouterLink } from '@angular/router';

@Component({
  selector: 'app-root',
  standalone: true,
  imports: [RouterOutlet, RouterLink],
  template: `
    <div>
      <h1>Angular Simple Test App</h1>
      <nav>
        <a routerLink="/">Home</a> |
        <a routerLink="/about/123">About</a> |
        <a routerLink="/contact">Contact</a> |
        <a routerLink="/dashboard">Dashboard</a> |
        <a routerLink="/settings">Settings</a> |
        <a routerLink="/users/1">User Profile</a>
      </nav>
      <hr>
      <router-outlet></router-outlet>
    </div>
  `,
})
export class AppComponent {} 