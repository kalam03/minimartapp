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
  userName: string = '';
  password: string = '';
  tenantId: number = 1;
  isLoading: boolean = false;

  constructor(
    private authService: AuthService,
    private alertService: AlertService
  ) {}

  onSubmit(): void {
    if (!this.userName || !this.password) {
      this.alertService.warning('Please enter username and password', 'Validation Error');
      return;
    }

    this.isLoading = true;

    this.authService.login({
      userName: this.userName,
      password: this.password,
      tenantId: this.tenantId
    }).subscribe({
      next: () => {
        // Auth service handles redirect to dashboard
      },
      error: (error) => {
        this.isLoading = false;
        const msg = error?.error?.message || 'Invalid username or password';
        this.alertService.error(msg, 'Login Failed');
      }
    });
  }
}
