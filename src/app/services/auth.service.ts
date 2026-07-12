// services/auth.service.ts
import { Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable, BehaviorSubject } from 'rxjs';
import { tap, switchMap, catchError } from 'rxjs/operators';
import { Router } from '@angular/router';
import { environment } from '../../environments/environment';
import { PermissionService } from './permission.service';
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

  private isAuthenticatedSubject = new BehaviorSubject<boolean>(this.hasToken());
  public  isAuthenticated$       = this.isAuthenticatedSubject.asObservable();

  constructor(
    private http:        HttpClient,
    private router:      Router,
    private permSvc:     PermissionService
  ) {}

  login(credentials: LoginRequest): Observable<LoginResponse> {
    return this.http.post<LoginResponse>(`${this.apiUrl}/login`, credentials).pipe(
      tap(response => {
        this.setSession(response);
        this.isAuthenticatedSubject.next(true);
      }),
      switchMap(response => {
        // Load the user's permitted menus BEFORE navigating,
        // so the sidebar and route guard have data on first render.
        return this.permSvc.loadMyMenus().pipe(
          catchError(() => of(null)),                 // don't block login if API fails
          tap(() => this.router.navigate(['/dashboard'])),
          // Restore original LoginResponse for subscribers (login component)
          switchMap(() => of(response))
        );
      })
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
      switchMap(response => {
        return this.permSvc.loadMyMenus().pipe(
          catchError(() => of(null)),
          tap(() => this.router.navigate(['/dashboard'])),
          switchMap(() => of(response))
        );
      })
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
