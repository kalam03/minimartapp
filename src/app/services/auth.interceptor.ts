// interceptors/auth.interceptor.ts
import { Injectable } from '@angular/core';
import { HttpInterceptor, HttpRequest, HttpHandler, HttpEvent, HttpErrorResponse } from '@angular/common/http';
import { Observable, throwError } from 'rxjs';
import { catchError, switchMap } from 'rxjs/operators';
import { Router } from '@angular/router';
import { AlertService } from '../shared/alert.service';

@Injectable()
export class AuthInterceptor implements HttpInterceptor {
  constructor(
    private router: Router,
    private alertService: AlertService
  ) {}

  intercept(req: HttpRequest<any>, next: HttpHandler): Observable<HttpEvent<any>> {
    // Get token from session storage
    const token = sessionStorage.getItem('access_token');
    
    // Clone the request and add authorization header
    let authReq = req;
    if (token) {
      authReq = req.clone({
        setHeaders: {
          Authorization: `Bearer ${token}`
        }
      });
    }
    
    return next.handle(authReq).pipe(
      catchError((error: HttpErrorResponse) => {
        if (error.status === 401) {
          // Token expired or unauthorized
          this.handleUnauthorized();
        }
        return throwError(() => error);
      })
    );
  }
  
  private handleUnauthorized(): void {
    // Clear session storage
    sessionStorage.clear();
    // Redirect to login page
    this.router.navigate(['/login']);
    this.alertService.warning('Session expired. Please login again.', 'Unauthorized');
  }
}