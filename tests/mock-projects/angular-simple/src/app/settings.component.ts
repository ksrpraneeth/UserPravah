import { Component } from '@angular/core';
import { Router } from '@angular/router';

@Component({
  standalone: true,
  imports: [],
  template: `
    <div class="page">
      <h1>Settings</h1>
      <p>Configure your application preferences and account settings.</p>
      
      <div class="settings-sections">
        <div class="settings-section">
          <h2>Account Settings</h2>
          <p>Manage your account information and preferences</p>
          <button class="button" (click)="goToUserProfile()">Edit Profile</button>
        </div>
        
        <div class="settings-section">
          <h2>Notifications</h2>
          <p>Configure notification preferences</p>
          <button class="button" (click)="configureNotifications()">Configure</button>
        </div>
        
        <div class="settings-section">
          <h2>Privacy</h2>
          <p>Manage privacy and security settings</p>
          <button class="button" (click)="managePrivacy()">Manage Privacy</button>
        </div>
      </div>
      
      <div class="button-group">
        <button class="button" (click)="goToDashboard()">Back to Dashboard</button>
        <button class="button" (click)="goHome()">Go to Home</button>
        <button class="button" (click)="goToContact()">Contact Support</button>
      </div>
    </div>
  `,
  styles: [`
    .settings-sections {
      margin: 30px 0;
    }
    
    .settings-section {
      border: 1px solid #ddd;
      border-radius: 8px;
      padding: 20px;
      margin-bottom: 20px;
      background: #f9f9f9;
    }
    
    .settings-section h2 {
      margin-top: 0;
      color: #1976d2;
    }
  `]
})
export class SettingsComponent {
  constructor(private router: Router) {}

  goHome(): void {
    this.router.navigate(['/']);
  }

  goToDashboard(): void {
    this.router.navigate(['/dashboard']);
  }

  goToUserProfile(): void {
    this.router.navigate(['/users', 'current']);
  }

  goToContact(): void {
    this.router.navigateByUrl('/contact');
  }

  configureNotifications(): void {
    // Simulate navigation to a sub-settings page
    this.router.navigate(['/about', 'notifications']);
  }

  managePrivacy(): void {
    // Simulate conditional navigation
    const isAuthenticated = true;
    if (isAuthenticated) {
      this.router.navigate(['/about', 'privacy']);
    }
  }
} 