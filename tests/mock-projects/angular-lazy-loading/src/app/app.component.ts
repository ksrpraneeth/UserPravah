import { Component } from '@angular/core';
import { RouterOutlet, RouterLink } from '@angular/router';

@Component({
  selector: 'app-root',
  standalone: true,
  imports: [RouterOutlet, RouterLink],
  template: `
    <nav>
      <a routerLink="/">Home</a> |
      <a routerLink="/feature">Lazy Feature (with Guard/Data)</a> |
      <a routerLink="/detail">Standalone Detail (Lazy Component)</a>
    </nav>
    <router-outlet></router-outlet>
  `,
})
export class AppComponent {} 