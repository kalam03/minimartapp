import { Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable, BehaviorSubject, from } from 'rxjs';
import { tap, switchMap, catchError } from 'rxjs/operators';
import { Router } from '@angular/router';
import { environment } from '../../environments/environment';
import { PermissionService } from './permission.service';
import { LanguageService } from './language.service';
import { of } from 'rxjs';

export interface LoginRequest {
  userName: string;
  password: string;
  // Optional; backend otherwise resolves tenant by matching password hash across accounts with this username (see UserService.ValidateLogin)
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
    preferredLanguage?: string;
    // Users.EmployeeId link; used by pos-billing's "Pickup" transport type to auto-fill the counter employee
    employeeId?: number;
    employeeCode?: string;
    employeeName?: string;
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
    private languageSvc: LanguageService
  ) {}

  // Password never leaves the browser as plaintext: fetch the server's public key, RSA-OAEP encrypt {password, ts} client-side, send only the ciphertext.
  login(credentials: LoginRequest): Observable<LoginResponse> {
    return this.http.get<{ publicKey: string }>(`${this.apiUrl}/public-key`).pipe(
      switchMap(res => from(this.encryptPassword(credentials.password, res.publicKey))),
      switchMap(encryptedPassword => this.http.post<LoginResponse>(`${this.apiUrl}/login`, {
        userName: credentials.userName,
        tenantId: credentials.tenantId,
        encryptedPassword
      })),
      tap(response => {
        this.setSession(response);
        this.isAuthenticatedSubject.next(true);
      }),
      switchMap(response => this.finishLoginAndRedirect(response))
    );
  }

  // RSA-OAEP-SHA256 via Web Crypto API; the embedded timestamp lets the backend reject a replayed ciphertext after ~2 minutes.
  private async encryptPassword(password: string, publicKeyBase64: string): Promise<string> {
    const derBytes = Uint8Array.from(atob(publicKeyBase64), c => c.charCodeAt(0));
    const cryptoKey = await crypto.subtle.importKey(
      'spki', derBytes.buffer, { name: 'RSA-OAEP', hash: 'SHA-256' }, false, ['encrypt']
    );
    const payload = JSON.stringify({ password, ts: Date.now() });
    const cipherBuffer = await crypto.subtle.encrypt(
      { name: 'RSA-OAEP' }, cryptoKey, new TextEncoder().encode(payload)
    );
    return btoa(String.fromCharCode(...new Uint8Array(cipherBuffer)));
  }

  // Creates the tenant + first admin user, then logs the caller straight in (same as login())
  registerTenant(payload: RegisterTenantRequest): Observable<LoginResponse> {
    return this.http.post<LoginResponse>(`${this.apiUrl}/register-tenant`, payload).pipe(
      tap(response => {
        this.setSession(response);
        this.isAuthenticatedSubject.next(true);
      }),
      switchMap(response => this.finishLoginAndRedirect(response))
    );
  }

  // Reads a claim straight out of the JWT payload (base64url, no verification needed client-side — the server already signed/validated it) so the redirect decision always matches exactly what SubscriptionValidationMiddleware will enforce server-side, instead of a second /subscription/my round trip that could drift out of sync.
  private decodeJwtClaim(token: string, claim: string): string | null {
    try {
      const payload = JSON.parse(atob(token.split('.')[1].replace(/-/g, '+').replace(/_/g, '/')));
      return payload[claim] ?? null;
    } catch {
      return null;
    }
  }

  // Expired/Suspended/Cancelled tenants land on the renewal page; PendingVerification tenants land on the "payment under review" page; Suspended tenants are already blocked server-side at /login
  private finishLoginAndRedirect(response: LoginResponse): Observable<LoginResponse> {
    const status = this.decodeJwtClaim(response.accessToken, 'subscriptionStatus');
    if (status) {
      sessionStorage.setItem(this.subStatusKey, status);
    } else {
      sessionStorage.removeItem(this.subStatusKey);
    }

    return this.permSvc.loadMyMenus().pipe(
      catchError(() => of(null)),                    // don't block login if API fails
      tap(() => {
        const dest =
          status === 'PendingVerification' ? '/subscription/pending-verification' :
          status === 'Expired' || status === 'Suspended' || status === 'Cancelled' ? '/subscription/renew' :
          '/dashboard';
        this.router.navigate([dest]);
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

    // Reconciles with the profile's saved language, which may differ from this browser's localStorage/cookie value
    this.languageSvc.syncFromUserProfile(authResult.user.preferredLanguage);
  }

  private clearSession(): void {
    sessionStorage.removeItem(this.tokenKey);
    sessionStorage.removeItem(this.userKey);
    sessionStorage.removeItem(this.tenantKey);
    sessionStorage.removeItem(this.subStatusKey);
  }

  // Called after a successful renew/change-plan so SubscriptionGuard stops redirecting to the renew page
  markSubscriptionActive(): void {
    sessionStorage.setItem(this.subStatusKey, 'Active');
  }

  // Called right after a Send Money payment is submitted, so SubscriptionGuard immediately routes to the pending-verification page instead of the stale Expired/Trial status from login
  markSubscriptionPending(): void {
    sessionStorage.setItem(this.subStatusKey, 'PendingVerification');
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
