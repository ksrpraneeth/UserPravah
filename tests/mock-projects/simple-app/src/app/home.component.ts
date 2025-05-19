import { Component } from '@angular/core';
import { Router } from '@angular/router';

@Component({
  standalone: true,
  imports: [],
  template: `
    <h1>Home Page</h1>
    <button (click)="goToAbout()">(Programmatic) Go to About Page with ID 123</button>
    <br>
    <button (click)="goToAboutByUrl()">(Programmatic) Go to About Page with ID 456 (via URL)</button>
  `,
})
export class HomeComponent {
  private condition = true; // For testing conditional navigation parsing

  constructor(private router: Router) {}

  goToAbout(): void {
    // Test programmatic navigation with a condition
    if (this.condition) {
      this.router.navigate(['/about', '123']);
    }
  }

  goToAboutByUrl(): void {
    // Test programmatic navigation with navigateByUrl
    this.router.navigateByUrl('/about/456');
  }
} 