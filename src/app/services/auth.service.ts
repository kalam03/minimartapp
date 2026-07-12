// services/auth.service.ts
import { Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable, BehaviorSubject } from 'rxjs';
import { tap, switchMap, catchError } from 'rxjs/operators';
import { Router } from '@angular/router';
import { environment } from '../../environments/environment';
import { PermissionService } from './permission.service';
import { SubscriptionService } from './subscription.service';
import { of } from 'rxjs';

export interface LoginRequest {
  userName: string;
  password: string;
  // Optional — the backend resolves the tenant by matching the password
  // hash against every account with this username (see UserService.ValidateLogin).
  // Only needed if you want to force login against one specific tenant.
  tenantId?: number;
}

export interface RegisterTenantRequest {
  tenantName: string;
  contactPerson?: string;
  phone?: string;
  email?: string;
  address?: string;
  adminUserName: string;
  adminPassword: string;
}

export interface LoginResponse {
  accessToken: string;
  tokenType:   string;
  user: {
    userId:    number;
    tenantId:  number;
    userName:  string;
    role:      string;
    roleNames: string;
  };
}

@Injectable({ providedIn: 'root' })
export class AuthService {
  private apiUrl    = `${environment.baseUrl}/auth`;
  private tokenKey  = 'access_token';
  private userKey   = 'user_info';
  private tenantKey = 'tenant_id';
  private subStatusKey = 'subscription_status';

  private isAuthenticatedSubject = new BehaviorSubject<boolean>(this.hasToken());
  public  isAuthenticated$       = this.isAuthenticatedSubject.asObservable();

  constructor(
    private http:        HttpClient,
    private router:      Router,
    private permSvc:     PermissionService,
    private subSvc:      SubscriptionService
  ) {}

  login(credentials: LoginRequest): Observable<LoginResponse> {
    return this.http.post<LoginResponse>(`${this.apiUrl}/login`, credentials).pipe(
      tap(response => {
        this.setSession(response);
        this.isAuthenticatedSubject.next(true);
      }),
      switchMap(response => this.finishLoginAndRedirect(response))
    );
  }

  // Public self-service signup — creates the tenant + first admin user, then
  // logs the caller straight in (same session setup + redirect as login()).
  registerTenant(payload: RegisterTenantRequest): Observable<LoginResponse> {
    return this.http.post<LoginResponse>(`${this.apiUrl}/register-tenant`, payload).pipe(
      tap(response => {
        this.setSession(response);
        this.isAuthenticatedSubject.next(true);
      }),
      switchMap(response => this.finishLoginAndRedirect(response))
    );
  }

  // Shared by login() and registerTenant(): loads the sidebar/permission
  // cache, then checks the tenant's subscription status. A tenant whose
  // subscription has lapsed (computedStatus === 'Expired') is sent to the
  // self-service renewal page instead of the dashboard — they can still log
  // in (unlike a Suspended tenant, which is blocked server-side at /login),
  // but can't use the app until they renew or pick a plan.
  private finishLoginAndRedirect(response: LoginResponse): Observable<LoginResponse> {
    return this.permSvc.loadMyMenus().pipe(
      catchError(() => of(null)),                    // don't block login if API fails
      switchMap(() => this.subSvc.getMySubscription().pipe(catchError(() => of(null)))),
      tap((subRes: any) => {
        const status: string | undefined = subRes?.data?.computedStatus;
        if (status) {
          sessionStorage.setItem(this.subStatusKey, status);
        } else {
          sessionStorage.removeItem(this.subStatusKey);
        }
        this.router.navigate([status === 'Expired' ? '/subscription/renew' : '/dashboard']);
      }),
      switchMap(() => of(response))    // restore original LoginResponse for subscribers
    );
  }

  logout(): void {
    this.permSvc.clearMenus();
    this.clearSession();
    this.isAuthenticatedSubject.next(false);
    this.router.navigate(['/login']);
  }

  private setSession(authResult: LoginResponse): void {
    sessionStorage.setItem(this.tokenKey,  authResult.accessToken);
    sessionStorage.setItem(this.userKey,   JSON.stringify(authResult.user));
    sessionStorage.setItem(this.tenantKey, authResult.user.tenantId.toString());
  }

  private clearSession(): void {
    sessionStorage.removeItem(this.tokenKey);
    sessionStorage.removeItem(this.userKey);
    sessionStorage.removeItem(this.tenantKey);
    sessionStorage.removeItem(this.subStatusKey);
  }

  // Called by SubscriptionRenewComponent after a successful renew/change-plan
  // so the SubscriptionGuard stops redirecting them back to the renew page.
  markSubscriptionActive(): void {
    sessionStorage.setItem(this.subStatusKey, 'Active');
  }

  getToken(): string | null {
    return sessionStorage.getItem(this.tokenKey);
  }

  getUser(): LoginResponse['user'] | null {
    const userStr = sessionStorage.getItem(this.userKey);
    return userStr ? JSON.parse(userStr) : null;
  }

  getTenantId(): number {
    const stored = sessionStorage.getItem(this.tenantKey);
    if (stored) return parseInt(stored, 10);
    return this.getUser()?.tenantId ?? 1;
  }

  isAdmin(): boolean {
    const role = this.getUser()?.role?.toLowerCase() ?? '';
    return role === 'admin' || role === 'superadmin';
  }

  hasToken():       boolean { return !!this.getToken(); }
  isAuthenticated():boolean { return this.hasToken(); }
}
