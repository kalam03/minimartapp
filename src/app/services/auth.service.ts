// services/auth.service.ts
import { Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable, BehaviorSubject } from 'rxjs';
import { tap } from 'rxjs/operators';
import { Router } from '@angular/router';
import { environment } from '../../environments/environment';

export interface LoginRequest {
  username: string;
  password: string;
}

export interface LoginResponse {
  access_token: string;
  refresh_token: string;
  token_type: string;
  expires_in: number;
  user: {
    id: number;
    name: string;
    email: string;
    tenantId: number;
    role: string;
  };
}

@Injectable({
  providedIn: 'root'
})
export class AuthService {
  private apiUrl = `${environment.baseUrl}/auth`;
  private tokenKey = 'access_token';
  private refreshTokenKey = 'refresh_token';
  private userKey = 'user_info';
  
  private isAuthenticatedSubject = new BehaviorSubject<boolean>(this.hasToken());
  public isAuthenticated$ = this.isAuthenticatedSubject.asObservable();

  constructor(
    private http: HttpClient,
    private router: Router
  ) {}

  login(credentials: LoginRequest): Observable<LoginResponse> {
    debugger;
    return this.http.post<LoginResponse>(`${this.apiUrl}/login`, credentials).pipe(
      tap(response => {
        this.setSession(response);
        this.isAuthenticatedSubject.next(true);
        // Redirect to dashboard after login
        this.router.navigate(['/dashboard']);
      })
    );
  }

  logout(): void {
    this.clearSession();
    this.isAuthenticatedSubject.next(false);
    // Redirect to login page
    this.router.navigate(['/login']);
  }

  refreshToken(): Observable<LoginResponse> {
    const refreshToken = this.getRefreshToken();
    return this.http.post<LoginResponse>(`${this.apiUrl}/refresh`, { refreshToken }).pipe(
      tap(response => {
        this.setSession(response);
      })
    );
  }

  private setSession(authResult: LoginResponse): void {
    sessionStorage.setItem(this.tokenKey, authResult.access_token);
    sessionStorage.setItem(this.refreshTokenKey, authResult.refresh_token);
    sessionStorage.setItem(this.userKey, JSON.stringify(authResult.user));
  }

  private clearSession(): void {
    sessionStorage.removeItem(this.tokenKey);
    sessionStorage.removeItem(this.refreshTokenKey);
    sessionStorage.removeItem(this.userKey);
  }

  getToken(): string | null {
    return sessionStorage.getItem(this.tokenKey);
  }

  getRefreshToken(): string | null {
    return sessionStorage.getItem(this.refreshTokenKey);
  }

  getUser(): any {
    const userStr = sessionStorage.getItem(this.userKey);
    return userStr ? JSON.parse(userStr) : null;
  }

  getTenantId(): number {
    const user = this.getUser();
    return user?.tenantId || 1;
  }

  hasToken(): boolean {
    return !!this.getToken();
  }

  isAuthenticated(): boolean {
    return this.hasToken();
  }
}