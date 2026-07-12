import { HttpClient } from '@angular/common/http';
import { Injectable } from '@angular/core';
import { Observable } from 'rxjs';
import { environment } from '../../environments/environment';

export interface ActiveSubscription {
  subscriptionId: number;
  tenantId: number;
  planId: number;
  planCode: string;
  planName: string;
  maxUsers: number | null;
  maxBranches: number | null;
  startDate: string;
  endDate: string;
  trialEndDate: string | null;
  autoRenew: boolean;
  computedStatus: 'Trial' | 'Active' | 'Expired' | 'Suspended' | 'Cancelled' | string;
  daysRemaining: number;
}

export interface TenantModule {
  moduleCode: string;
  moduleName: string;
  icon: string | null;
  isEnabled: boolean;
}

export interface SubscriptionPlan {
  planId: number;
  planCode: string;
  planName: string;
  description: string | null;
  billingCycle: string;
  price: number;
  currency: string;
  trialDays: number;
  maxUsers: number | null;
  maxBranches: number | null;
  sortOrder: number;
  isActive: boolean;
  createdAt: string;
}

export interface SubscriptionPayment {
  paymentId: number;
  tenantId: number;
  subscriptionId: number;
  amount: number;
  currency: string;
  paymentMethod: string | null;
  transactionRef: string | null;
  status: string;
  periodStart: string | null;
  periodEnd: string | null;
  paidAt: string | null;
  notes: string | null;
  createdBy: string | null;
  createdAt: string;
}

/**
 * Tenant-facing subscription endpoints ("My Subscription" page, upgrade
 * page). For cross-tenant Super Admin operations, see super-admin.service.ts.
 */
@Injectable({ providedIn: 'root' })
export class SubscriptionService {
  private baseUrl = environment.baseUrl;

  constructor(private http: HttpClient) {}

  getMySubscription(): Observable<{ success: boolean; data: ActiveSubscription }> {
    return this.http.get<any>(`${this.baseUrl}/subscription/my`);
  }

  getMyModules(): Observable<{ success: boolean; data: TenantModule[] }> {
    return this.http.get<any>(`${this.baseUrl}/subscription/my-modules`);
  }

  getMyPayments(): Observable<{ success: boolean; data: SubscriptionPayment[] }> {
    return this.http.get<any>(`${this.baseUrl}/subscription/my-payments`);
  }

  getPlans(): Observable<{ success: boolean; data: SubscriptionPlan[] }> {
    return this.http.get<any>(`${this.baseUrl}/subscription/plans`);
  }
}
