// services/auth.service.ts
import { Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable, BehaviorSubject } from 'rxjs';
import { tap } from 'rxjs/operators';
import { Router } from '@angular/router';
import { environment } from '../../environments/environment';

export interface LoginRequest {
  userName: string;
  password: string;
  tenantId: number;
}

export interface LoginResponse {
  accessToken:  string;
  tokenType:    string;
  user: {
    userId:    number;
    tenantId:  number;
    userName:  string;
    role:      string;
    roleNames: string;
  };
}

@Injectable({
  providedIn: 'root'
})
export class AuthService {
  private apiUrl  = `${environment.baseUrl}/auth`;
  private tokenKey   = 'access_token';
  private userKey    = 'user_info';
  private tenantKey  = 'tenant_id';

  private isAuthenticatedSubject = new BehaviorSubject<boolean>(this.hasToken());
  public  isAuthenticated$       = this.isAuthenticatedSubject.asObservable();

  constructor(
    private http:   HttpClient,
    private router: Router
  ) {}

  login(credentials: LoginRequest): Observable<LoginResponse> {
    return this.http.post<LoginResponse>(`${this.apiUrl}/login`, credentials).pipe(
      tap(response => {
        this.setSession(response);
        this.isAuthenticatedSubject.next(true);
        this.router.navigate(['/dashboard']);
      })
    );
  }

  logout(): void {
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

  hasToken(): boolean   { return !!this.getToken(); }
  isAuthenticated(): boolean { return this.hasToken(); }
}
