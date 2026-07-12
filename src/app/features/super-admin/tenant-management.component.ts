import { Component, OnInit, ChangeDetectorRef } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { SuperAdminService, TenantWithSubscription, RegisterTenantRequest } from '../../services/super-admin.service';
import { SubscriptionPlan } from '../../services/subscription.service';
import { AlertService } from '../../shared/alert.service';

/**
 * Super Admin — Tenant Management. Cross-tenant view of every tenant's
 * subscription status with quick actions (suspend/reactivate/renew).
 *
 * Reference implementation for the pattern — Plans/Payments/Audit-Logs
 * admin screens follow the identical shape (filter bar + themed table +
 * action buttons calling SuperAdminService) and are straightforward
 * follow-ups once this one is reviewed.
 *
 * Not linked from the regular sidebar (FALLBACK_NAV) since SuperAdmin is a
 * platform-operator role, distinct from a tenant's own "admin" role — see
 * SaaS_Platform_Architecture.md Section 11. Reachable directly at
 * /superadmin/tenants for accounts that actually hold the SuperAdmin role;
 * the backend rejects everyone else with 403 regardless of this route
 * existing.
 */
@Component({
  selector: 'app-tenant-management',
  standalone: true,
  imports: [CommonModule, FormsModule],
  templateUrl: './tenant-management.component.html',
  styleUrls: ['./tenant-management.component.css']
})
export class TenantManagementComponent implements OnInit {
  tenants: TenantWithSubscription[] = [];
  searchText = '';
  statusFilter: string = '';

  isLoading = false;
  errorMsg  = '';

  // ── Register New Tenant ──────────────────────────────────────────────
  showRegisterModal = false;
  isRegistering = false;
  registerError = '';
  plans: SubscriptionPlan[] = [];
  registerForm: RegisterTenantRequest = this.emptyRegisterForm();

  constructor(
    private superAdminService: SuperAdminService,
    private alertService: AlertService,
    private cdr: ChangeDetectorRef
  ) {}

  ngOnInit(): void {
    this.loadTenants();
  }

  private emptyRegisterForm(): RegisterTenantRequest {
    return {
      tenantName: '',
      contactPerson: '',
      phone: '',
      email: '',
      address: '',
      subdomain: '',
      planCode: 'TRIAL',
      adminUserName: '',
      adminPassword: ''
    };
  }

  openRegisterModal(): void {
    this.registerForm  = this.emptyRegisterForm();
    this.registerError = '';
    this.showRegisterModal = true;
    if (this.plans.length === 0) {
      this.superAdminService.getPlans().subscribe({
        next: (res) => { this.plans = res.success ? res.data : []; this.cdr.detectChanges(); },
        error: () => { /* plan dropdown just falls back to a free-text default of TRIAL */ }
      });
    }
  }

  closeRegisterModal(): void {
    this.showRegisterModal = false;
  }

  submitRegister(): void {
    if (!this.registerForm.tenantName.trim() || !this.registerForm.adminUserName.trim() || !this.registerForm.adminPassword.trim()) {
      this.registerError = 'Tenant name, admin user name, and admin password are required.';
      return;
    }

    this.isRegistering = true;
    this.registerError = '';
    this.superAdminService.registerTenant(this.registerForm).subscribe({
      next: () => {
        this.isRegistering = false;
        this.showRegisterModal = false;
        this.alertService.success(`Tenant "${this.registerForm.tenantName}" registered`);
        this.loadTenants();
      },
      error: (err) => {
        this.isRegistering = false;
        this.registerError = err?.error?.message || 'Failed to register tenant';
        this.cdr.detectChanges();
      }
    });
  }

  loadTenants(): void {
    this.isLoading = true;
    this.errorMsg  = '';
    this.superAdminService.getTenants().subscribe({
      next: (res) => {
        this.tenants = res.success ? res.data : [];
        this.isLoading = false;
        this.cdr.detectChanges();
      },
      error: (err) => {
        this.tenants   = [];
        this.errorMsg  = err?.error?.message || 'Failed to load tenants';
        this.isLoading = false;
        this.cdr.detectChanges();
      }
    });
  }

  get filteredTenants(): TenantWithSubscription[] {
    const q = this.searchText.toLowerCase().trim();
    return this.tenants.filter(t => {
      const matchesSearch = !q ||
        t.tenantName.toLowerCase().includes(q) ||
        (t.contactPerson || '').toLowerCase().includes(q) ||
        (t.email || '').toLowerCase().includes(q);
      const matchesStatus = !this.statusFilter || t.computedStatus === this.statusFilter;
      return matchesSearch && matchesStatus;
    });
  }

  statusBadgeClass(status: string): string {
    switch (status) {
      case 'Active':    return 'bg-green-100 text-green-800';
      case 'Trial':     return 'bg-blue-100 text-blue-800';
      case 'Expired':   return 'bg-red-100 text-red-800';
      case 'Suspended': return 'bg-gray-200 text-gray-700';
      default:          return 'bg-gray-100 text-gray-600';
    }
  }

  suspend(tenant: TenantWithSubscription): void {
    this.alertService.confirm(`Suspend "${tenant.tenantName}"? They will lose access immediately.`).then((confirmed) => {
      if (!confirmed) return;
      const reason = window.prompt('Reason for suspension (optional):') || '';
      this.superAdminService.suspendTenant(tenant.tenantId, reason).subscribe({
        next: () => { this.alertService.success('Tenant suspended'); this.loadTenants(); },
        error: (err) => this.alertService.error('Failed to suspend: ' + (err.error?.message || err.message))
      });
    });
  }

  reactivate(tenant: TenantWithSubscription): void {
    this.superAdminService.reactivateTenant(tenant.tenantId).subscribe({
      next: () => { this.alertService.success('Tenant reactivated'); this.loadTenants(); },
      error: (err) => this.alertService.error('Failed to reactivate: ' + (err.error?.message || err.message))
    });
  }

  renewOneMonth(tenant: TenantWithSubscription): void {
    this.superAdminService.renewSubscription(tenant.tenantId, 1).subscribe({
      next: () => { this.alertService.success('Subscription renewed by 1 month'); this.loadTenants(); },
      error: (err) => this.alertService.error('Failed to renew: ' + (err.error?.message || err.message))
    });
  }
}
