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

export type PaymentMethod = 'bKash' | 'Nagad' | 'Rocket' | 'Card';

export interface CheckoutRequest {
  // Omit to renew the CURRENT plan as-is; set to switch to a different plan.
  planId?: number;
  paymentMethod: PaymentMethod;
  // Mobile banking (bKash/Nagad/Rocket) — the wallet number.
  accountNumber?: string;
  // Card — LAST 4 DIGITS ONLY. The full card number/CVV never leave the
  // payment form component, let alone get sent to this API.
  cardLast4?: string;
}

export interface CheckoutResult {
  paymentId: number;
  planName: string;
  amount: number;
  currency: string;
  newEndDate: string;
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

  // Self-service — renews/activates the CALLER's own tenant (tenantId comes
  // from the JWT server-side, never from the request body).
  renew(months = 1): Observable<{ success: boolean; message: string }> {
    return this.http.post<any>(`${this.baseUrl}/subscription/renew`, { months });
  }

  changePlan(newPlanId: number, keepEndDate = true): Observable<{ success: boolean; message: string }> {
    return this.http.post<any>(`${this.baseUrl}/subscription/change-plan`, { newPlanId, keepEndDate });
  }

  // Payment method page submits here — activates the plan and records the
  // payment in one call (see SubscriptionService.Checkout on the backend).
  checkout(payload: CheckoutRequest): Observable<{ success: boolean; message: string; data: CheckoutResult }> {
    return this.http.post<any>(`${this.baseUrl}/subscription/checkout`, payload);
  }
}
