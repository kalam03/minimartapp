import { HttpClient } from '@angular/common/http';
import { Injectable } from '@angular/core';
import { Observable } from 'rxjs';
import { environment } from '../../environments/environment';
import { SubscriptionPayment, SubscriptionPlan } from './subscription.service';

export interface TenantWithSubscription {
  tenantId: number;
  tenantName: string;
  contactPerson: string | null;
  phone: string | null;
  email: string | null;
  status: string;
  isActive: boolean;
  planCode: string | null;
  planName: string | null;
  endDate: string | null;
  trialEndDate: string | null;
  computedStatus: 'Trial' | 'Active' | 'Expired' | 'Suspended' | string;
  daysRemaining: number | null;
}

export interface RegisterTenantRequest {
  tenantName: string;
  contactPerson?: string;
  phone?: string;
  email?: string;
  address?: string;
  subdomain?: string;
  planCode: string;
  adminUserName: string;
  adminPassword: string;
}

export interface AuditLogEntry {
  auditLogId: number;
  tenantId: number | null;
  userId: number | null;
  userName: string | null;
  action: string;
  entityName: string;
  entityId: string | null;
  oldValues: string | null;
  newValues: string | null;
  ipAddress: string | null;
  createdAt: string;
}

/**
 * Cross-tenant management — Super Admin only. Every call requires a
 * "SuperAdmin" role on the logged-in user (enforced server-side by
 * SuperAdminController's [Authorize(Roles = "SuperAdmin")]).
 */
@Injectable({ providedIn: 'root' })
export class SuperAdminService {
  private baseUrl = environment.baseUrl;

  constructor(private http: HttpClient) {}

  registerTenant(payload: RegisterTenantRequest): Observable<{ success: boolean; message: string; data: { tenantId: number; userId: number } }> {
    return this.http.post<any>(`${this.baseUrl}/superadmin/tenants`, payload);
  }

  getTenants(): Observable<{ success: boolean; data: TenantWithSubscription[] }> {
    return this.http.get<any>(`${this.baseUrl}/superadmin/tenants`);
  }

  suspendTenant(tenantId: number, reason: string): Observable<{ success: boolean; message: string }> {
    return this.http.post<any>(`${this.baseUrl}/superadmin/tenants/${tenantId}/suspend`, { reason });
  }

  reactivateTenant(tenantId: number): Observable<{ success: boolean; message: string }> {
    return this.http.post<any>(`${this.baseUrl}/superadmin/tenants/${tenantId}/reactivate`, {});
  }

  renewSubscription(tenantId: number, months: number): Observable<{ success: boolean; message: string }> {
    return this.http.post<any>(`${this.baseUrl}/superadmin/tenants/${tenantId}/renew`, { months });
  }

  changePlan(tenantId: number, newPlanId: number, keepEndDate = true): Observable<{ success: boolean; message: string }> {
    return this.http.post<any>(`${this.baseUrl}/superadmin/tenants/${tenantId}/change-plan`, { newPlanId, keepEndDate });
  }

  getPlans(): Observable<{ success: boolean; data: SubscriptionPlan[] }> {
    return this.http.get<any>(`${this.baseUrl}/superadmin/plans`);
  }

  getPayments(tenantId?: number): Observable<{ success: boolean; data: SubscriptionPayment[] }> {
    const query = tenantId ? `?tenantId=${tenantId}` : '';
    return this.http.get<any>(`${this.baseUrl}/superadmin/payments${query}`);
  }

  getAuditLogs(params: { tenantId?: number; entityName?: string; fromDate?: string; toDate?: string } = {}):
    Observable<{ success: boolean; data: AuditLogEntry[] }> {
    const search = new URLSearchParams();
    Object.entries(params).forEach(([k, v]) => { if (v) search.set(k, v.toString()); });
    const query = search.toString();
    return this.http.get<any>(`${this.baseUrl}/superadmin/audit-logs${query ? '?' + query : ''}`);
  }
}
