import { Component } from '@angular/core';
import { RouterLink } from '@angular/router';

@Component({
  standalone: true,
  imports: [RouterLink],
  template: `
    <h2>Lazy Loaded Feature Component</h2>
    <p>This component was lazy loaded!</p>
    <a routerLink="child-route">View Lazy Child</a>
  `,
})
export class LazyComponent {} 