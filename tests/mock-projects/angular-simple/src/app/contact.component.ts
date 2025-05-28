import { Component } from '@angular/core';
import { Router } from '@angular/router';

@Component({
  standalone: true,
  imports: [],
  template: `
    <div class="page">
      <h1>Contact Us</h1>
      <p>Get in touch with our team for any questions or support.</p>
      
      <div class="contact-info">
        <h2>Contact Information</h2>
        <p>Email: contact&#64;example.com</p>
        <p>Phone: (555) 123-4567</p>
        <p>Address: 123 Main St, City, State 12345</p>
      </div>
      
      <div class="button-group">
        <button class="button" (click)="goHome()">Go to Home</button>
        <button class="button" (click)="goToAbout()">Go to About</button>
        <button class="button" (click)="goToDashboard()">Go to Dashboard</button>
      </div>
    </div>
  `,
})
export class ContactComponent {
  constructor(private router: Router) {}

  goHome(): void {
    this.router.navigate(['/']);
  }

  goToAbout(): void {
    this.router.navigate(['/about', 'contact-page']);
  }

  goToDashboard(): void {
    this.router.navigateByUrl('/dashboard');
  }
} 