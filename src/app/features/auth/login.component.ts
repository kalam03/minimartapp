import { Component, ChangeDetectorRef } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { RouterLink } from '@angular/router';
import { AuthService } from '../../services/auth.service';
import { AlertService } from '../../shared/alert.service';

@Component({
  selector: 'app-login',
  standalone: true,
  imports: [CommonModule, FormsModule, RouterLink],
  templateUrl: './login.component.html',
  styleUrls: ['./login.component.css']
})
export class LoginComponent {
  userName  = '';
  password  = '';
  isLoading = false;

  constructor(
    private authService: AuthService,
    private alertService: AlertService,
    private cdr: ChangeDetectorRef
  ) {}

  onSubmit(): void {
    if (!this.userName || !this.password) {
      this.alertService.warning('Please enter username and password', 'Validation Error');
      return;
    }

    this.isLoading = true;
    this.cdr.detectChanges();   // flush the true state before HTTP starts

    this.authService.login({
      userName: this.userName,
      password: this.password
    }).subscribe({
      next: () => {
        // AuthService handles the redirect to dashboard
      },
      error: (err) => {
        this.isLoading = false;
        this.cdr.detectChanges();  // flush the false state before alert renders
        const msg = err?.error?.message || 'Invalid username or password';
        // 403 = correct credentials but the tenant is suspended (see
        // TenantSuspendedException on the backend) — distinct from a
        // plain 401 wrong-password case, so the title reflects that.
        const title = err?.status === 403 ? 'Account Suspended' : 'Login Failed';
        this.alertService.error(msg, title);
      }
    });
  }
}
