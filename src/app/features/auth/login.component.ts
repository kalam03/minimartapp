// login.component.ts
import { Component } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { AuthService } from '../../services/auth.service';
import { AlertService } from '../../shared/alert.service';

@Component({
  selector: 'app-login',
  standalone: true,
  imports: [CommonModule, FormsModule],
  templateUrl: './login.component.html',
  styleUrls: ['./login.component.css']
})
export class LoginComponent {
  username: string = '';
  password: string = '';
  isLoading: boolean = false;

  constructor(
    private authService: AuthService,
    private alertService: AlertService
  ) {}

  onSubmit(): void {
    if (!this.username || !this.password) {
      this.alertService.warning('Please enter username and password', 'Validation Error');
      return;
    }

    this.isLoading = true;
    
    this.authService.login({
      username: this.username,
      password: this.password
    }).subscribe({
      next: (response) => {
        console.log('Login successful', response);
        this.alertService.success('Login successful!', 'Welcome');
        // Auth service handles redirect to dashboard
      },
      error: (error) => {
        this.isLoading = false;
        console.error('Login failed', error);
        this.alertService.error('Invalid username or password', 'Login Failed');
      }
    });
  }
}