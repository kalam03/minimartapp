import { Component, ChangeDetectorRef } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { RouterLink } from '@angular/router';
import { AuthService } from '../../services/auth.service';
import { AlertService } from '../../shared/alert.service';

/**
 * Public self-service tenant signup — "Register Tenant" link on the login
 * page lands here. Creates a brand-new tenant + its first ("Admin") user
 * via POST /api/auth/register-tenant (no login required to reach this
 * endpoint), then auto-logs the new admin straight into the dashboard,
 * same as a normal login.
 */
@Component({
  selector: 'app-register-tenant',
  standalone: true,
  imports: [CommonModule, FormsModule, RouterLink],
  templateUrl: './register-tenant.component.html',
  styleUrls: ['./register-tenant.component.css']
})
export class RegisterTenantComponent {
  tenantName    = '';
  contactPerson = '';
  phone         = '';
  email         = '';
  adminUserName = '';
  adminPassword = '';
  confirmPassword = '';

  isLoading = false;
  errorMsg  = '';

  constructor(
    private authService: AuthService,
    private alertService: AlertService,
    private cdr: ChangeDetectorRef
  ) {}

  onSubmit(): void {
    this.errorMsg = '';

    if (!this.tenantName.trim() || !this.adminUserName.trim() || !this.adminPassword.trim()) {
      this.errorMsg = 'Shop name, username, and password are required.';
      return;
    }
    if (this.adminPassword.length < 6) {
      this.errorMsg = 'Password must be at least 6 characters.';
      return;
    }
    if (this.adminPassword !== this.confirmPassword) {
      this.errorMsg = 'Passwords do not match.';
      return;
    }

    this.isLoading = true;
    this.cdr.detectChanges();

    this.authService.registerTenant({
      tenantName: this.tenantName,
      contactPerson: this.contactPerson || undefined,
      phone: this.phone || undefined,
      email: this.email || undefined,
      adminUserName: this.adminUserName,
      adminPassword: this.adminPassword
    }).subscribe({
      next: () => {
        // AuthService handles the redirect to dashboard
      },
      error: (err) => {
        this.isLoading = false;
        this.errorMsg = err?.error?.message || 'Registration failed. Please try again.';
        this.cdr.detectChanges();
        this.alertService.error(this.errorMsg, 'Registration Failed');
      }
    });
  }
}
