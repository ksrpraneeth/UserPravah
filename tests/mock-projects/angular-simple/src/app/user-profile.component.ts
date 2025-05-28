import { Component, OnInit } from '@angular/core';
import { ActivatedRoute, Router } from '@angular/router';

@Component({
  standalone: true,
  imports: [],
  template: `
    <div class="page">
      <h1>User Profile</h1>
      <p>Viewing profile for user ID: <strong>{{ userId }}</strong></p>
      
      <div class="profile-info">
        <h2>Profile Information</h2>
        <p><strong>User ID:</strong> {{ userId }}</p>
        <p><strong>Name:</strong> {{ getUserName() }}</p>
        <p><strong>Email:</strong> {{ getUserEmail() }}</p>
        <p><strong>Role:</strong> {{ getUserRole() }}</p>
      </div>
      
      <div class="profile-actions">
        <h2>Profile Actions</h2>
        <button class="button" (click)="editProfile()">Edit Profile</button>
        <button class="button" (click)="viewOtherUser()">View Another User</button>
        <button class="button" (click)="deleteProfile()">Delete Profile</button>
      </div>
      
      <div class="button-group">
        <button class="button" (click)="goToDashboard()">Back to Dashboard</button>
        <button class="button" (click)="goToSettings()">Go to Settings</button>
        <button class="button" (click)="goHome()">Go to Home</button>
      </div>
    </div>
  `,
  styles: [`
    .profile-info, .profile-actions {
      border: 1px solid #ddd;
      border-radius: 8px;
      padding: 20px;
      margin: 20px 0;
      background: #f9f9f9;
    }
    
    .profile-info h2, .profile-actions h2 {
      margin-top: 0;
      color: #1976d2;
    }
    
    .profile-actions .button {
      margin-right: 10px;
      margin-bottom: 10px;
    }
  `]
})
export class UserProfileComponent implements OnInit {
  userId: string = '';

  constructor(
    private route: ActivatedRoute,
    private router: Router
  ) {}

  ngOnInit(): void {
    this.userId = this.route.snapshot.paramMap.get('id') || 'unknown';
  }

  getUserName(): string {
    return `User ${this.userId}`;
  }

  getUserEmail(): string {
    return `user${this.userId}&#64;example.com`;
  }

  getUserRole(): string {
    return this.userId === '1' ? 'Administrator' : 'User';
  }

  goHome(): void {
    this.router.navigate(['/']);
  }

  goToDashboard(): void {
    this.router.navigate(['/dashboard']);
  }

  goToSettings(): void {
    this.router.navigate(['/settings']);
  }

  editProfile(): void {
    // Simulate navigation to edit mode
    this.router.navigate(['/about', `edit-${this.userId}`]);
  }

  viewOtherUser(): void {
    // Navigate to a different user profile
    const newUserId = this.userId === '1' ? '2' : '1';
    this.router.navigate(['/users', newUserId]);
  }

  deleteProfile(): void {
    // Simulate conditional navigation after deletion
    const confirmed = true; // In real app, this would be a confirmation dialog
    if (confirmed) {
      this.router.navigateByUrl('/dashboard');
    }
  }
} 