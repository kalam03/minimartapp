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
  requestedPlanId: number | null;
  senderAccountNumber: string | null;
  verifiedBy: string | null;
  verifiedAt: string | null;
}

//Admin-facing shape from GET /superadmin/payments/pending — same fields plus tenant/plan names
export interface PendingPayment extends SubscriptionPayment {
  tenantName: string;
  requestedPlanName: string | null;
}

export type PaymentMethod = 'bKash' | 'Nagad' | 'Rocket' | 'Bank';

export interface SubmitPaymentRequest {
  //Omit to renew the current plan as-is; set to switch to a different plan
  planId?: number;
  paymentMethod: PaymentMethod;
  //The TrxID/reference number from the bKash/Nagad/Rocket SMS or bank transfer receipt
  transactionId: string;
  //The wallet number or bank account the tenant sent money FROM, so the admin can cross-check it
  senderAccountNumber?: string;
}

export interface SubmitPaymentResult {
  paymentId: number;
}

//Tenant-facing subscription endpoints; cross-tenant Super Admin ops live in super-admin.service.ts
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

  //Self-service: tenantId comes from the JWT server-side, never from the request body
  renew(months = 1): Observable<{ success: boolean; message: string }> {
    return this.http.post<any>(`${this.baseUrl}/subscription/renew`, { months });
  }

  changePlan(newPlanId: number, keepEndDate = true): Observable<{ success: boolean; message: string }> {
    return this.http.post<any>(`${this.baseUrl}/subscription/change-plan`, { newPlanId, keepEndDate });
  }

  //Records the tenant's claim that they sent money; nothing is activated until a SuperAdmin verifies it (see SubscriptionVerification page)
  submitPaymentRequest(payload: SubmitPaymentRequest): Observable<{ success: boolean; message: string; data: SubmitPaymentResult }> {
    return this.http.post<any>(`${this.baseUrl}/subscription/payment-request`, payload);
  }
}
