import { Component } from '@angular/core';
import { Router } from '@angular/router';

@Component({
  standalone: true,
  imports: [],
  template: `
    <div>
      <h1>Welcome to Angular Simple Test App</h1>
      <p>This is a comprehensive Angular application for testing UserPravah's analysis capabilities.</p>
      
      <h2>Quick Actions</h2>
      <button (click)="goToAbout()">Go to About (ID: 123)</button>
      <button (click)="goToAboutByUrl()">Go to About (ID: 456)</button>
      <button (click)="goToDashboard()">Open Dashboard</button>
      <button (click)="goToUserProfile()">View User Profile</button>
      <button (click)="goToSettings()">Open Settings</button>
      <button (click)="goToContact()">Contact Us</button>
      
      <h2>Navigation Examples</h2>
      <button (click)="conditionalNavigation()">Conditional Navigation</button>
      <button (click)="dynamicNavigation()">Dynamic Navigation</button>
      <button (click)="complexNavigation()">Complex Navigation</button>
    </div>
  `
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

  goToDashboard(): void {
    this.router.navigate(['/dashboard']);
  }

  goToUserProfile(): void {
    this.router.navigate(['/users', '1']);
  }

  goToSettings(): void {
    this.router.navigate(['/settings']);
  }

  goToContact(): void {
    this.router.navigateByUrl('/contact');
  }

  conditionalNavigation(): void {
    // Simulate conditional navigation based on user state
    const isLoggedIn = true;
    if (isLoggedIn) {
      this.router.navigate(['/dashboard']);
    } else {
      this.router.navigate(['/about', 'login-required']);
    }
  }

  dynamicNavigation(): void {
    // Simulate dynamic navigation with computed route
    const userId = Math.floor(Math.random() * 10) + 1;
    this.router.navigate(['/users', userId.toString()]);
  }

  complexNavigation(): void {
    // Simulate complex navigation with multiple conditions
    const roles: ('admin' | 'user' | 'guest')[] = ['admin', 'user', 'guest'];
    const userRole = roles[Math.floor(Math.random() * roles.length)];
    const hasPermission = true;
    
    if (userRole === 'admin' && hasPermission) {
      this.router.navigate(['/about', 'admin-panel']);
    } else if (userRole === 'user') {
      this.router.navigate(['/users', 'current']);
    } else {
      this.router.navigateByUrl('/contact');
    }
  }
} 