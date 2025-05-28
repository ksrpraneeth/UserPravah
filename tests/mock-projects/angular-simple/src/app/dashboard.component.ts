import { Component } from '@angular/core';
import { Router } from '@angular/router';

@Component({
  standalone: true,
  imports: [],
  template: `
    <div class="page">
      <h1>Dashboard</h1>
      <p>Welcome to your dashboard! Here you can manage your account and view analytics.</p>
      
      <div class="dashboard-cards">
        <div class="card">
          <h3>User Management</h3>
          <p>Manage user accounts and permissions</p>
          <button class="button" (click)="goToUserProfile()">View User Profile</button>
        </div>
        
        <div class="card">
          <h3>Settings</h3>
          <p>Configure application settings</p>
          <button class="button" (click)="goToSettings()">Open Settings</button>
        </div>
        
        <div class="card">
          <h3>Analytics</h3>
          <p>View detailed analytics and reports</p>
          <button class="button" (click)="viewAnalytics()">View Analytics</button>
        </div>
      </div>
      
      <div class="button-group">
        <button class="button" (click)="goHome()">Back to Home</button>
        <button class="button" (click)="goToContact()">Contact Support</button>
      </div>
    </div>
  `,
  styles: [`
    .dashboard-cards {
      display: grid;
      grid-template-columns: repeat(auto-fit, minmax(250px, 1fr));
      gap: 20px;
      margin: 30px 0;
    }
    
    .card {
      border: 1px solid #ddd;
      border-radius: 8px;
      padding: 20px;
      background: #f9f9f9;
    }
    
    .card h3 {
      margin-top: 0;
      color: #1976d2;
    }
  `]
})
export class DashboardComponent {
  constructor(private router: Router) {}

  goHome(): void {
    this.router.navigate(['/']);
  }

  goToSettings(): void {
    this.router.navigate(['/settings']);
  }

  goToUserProfile(): void {
    this.router.navigate(['/users', '1']);
  }

  goToContact(): void {
    this.router.navigateByUrl('/contact');
  }

  viewAnalytics(): void {
    // Simulate conditional navigation
    const hasPermission = true;
    if (hasPermission) {
      this.router.navigate(['/about', 'analytics']);
    }
  }
} 