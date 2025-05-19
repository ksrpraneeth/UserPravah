import { Component } from '@angular/core';
import { RouterOutlet, RouterLink } from '@angular/router';

@Component({
  selector: 'app-root',
  standalone: true,
  imports: [RouterOutlet, RouterLink],
  template: `
    <nav>
      <a routerLink="/">Home (Root)</a> |
      <a routerLink="/home">Home (Redirects)</a> |
      <a routerLink="/about/test-id">About (test-id)</a> |
      <a routerLink="/non-existent-path">Non Existent (Wildcard)</a>
    </nav>
    <router-outlet></router-outlet>
  `,
})
export class AppComponent {} 