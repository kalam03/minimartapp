import { HttpClient } from '@angular/common/http';
import { Injectable } from '@angular/core';
import { BehaviorSubject, Observable, catchError, of, tap } from 'rxjs';
import { environment } from '../../environments/environment';

// ── DTOs ─────────────────────────────────────────────────────────────
export interface AppResource {
  resourceId:   number;
  functionId:   string;
  functionName: string;
  menuId:       string;
  menuName:     string;
  moduleId:     string;
  moduleName:   string;
  appRoute:     string;
  icon:         string;
  itemType:     string;
  quickRouteNo: string;
  isFinancial:  boolean;
  sortOrder:    number;
}

export interface UserPermissionRow extends AppResource {
  allowMaintAdd:     boolean;
  allowMaintEdit:    boolean;
  allowMaintDel:     boolean;
  allowMaintView:    boolean;
  allowMaintAuth:    boolean;
  allowProcess:      boolean;
  allowReportView:   boolean;
  allowReportPrint:  boolean;
  allowReportGen:    boolean;
  allowAnyOfficeOps: boolean;
}

export interface UserListItem {
  userId:   number;
  userName: string;
  role:     string;
  isActive: boolean;
}

export interface MyMenuItem {
  functionId:   string;
  functionName: string;
  appRoute:     string;
  icon:         string;
  moduleId:     string;
  moduleName:   string;
  menuId:       string;
  menuName:     string;
  sortOrder:    number;
  isFinancial:  boolean;
  quickRouteNo: string;
}

export interface NavItem {
  path:  string;
  icon:  string;
  label: string;
}

export interface SavePermissionsRequest {
  userId:      number;
  permissions: Array<{
    functionId:        string;
    allowMaintAdd:     boolean;
    allowMaintEdit:    boolean;
    allowMaintDel:     boolean;
    allowMaintView:    boolean;
    allowMaintAuth:    boolean;
    allowProcess:      boolean;
    allowReportView:   boolean;
    allowReportPrint:  boolean;
    allowReportGen:    boolean;
    allowAnyOfficeOps: boolean;
  }>;
}

// ── Service ───────────────────────────────────────────────────────────
@Injectable({ providedIn: 'root' })
export class PermissionService {

  private readonly ROUTES_KEY = 'permitted_routes';   // sessionStorage keys
  private readonly NAV_KEY    = 'nav_items';

  private _navItems$ = new BehaviorSubject<NavItem[]>([]);
  /** Emits the sidebar nav items the current user is allowed to see. */
  navItems$ = this._navItems$.asObservable();

  private base = environment.baseUrl + '/userpermission';

  constructor(private http: HttpClient) {
    // Restore cached nav on page refresh — token is still valid
    this.restoreFromStorage();
  }

  // ── Called once after login ────────────────────────────────────────
  loadMyMenus(): Observable<{ success: boolean; data: MyMenuItem[] }> {
    return this.http.get<{ success: boolean; data: MyMenuItem[] }>(`${this.base}/my-menus`).pipe(
      tap(res => {
        const menus: MyMenuItem[] = res?.data ?? [];
        // Save permitted route paths for the guard
        const routes = menus.map(m => m.appRoute.toLowerCase());
        sessionStorage.setItem(this.ROUTES_KEY, JSON.stringify(routes));
        // Save nav items for the sidebar
        const navItems: NavItem[] = menus
          .sort((a, b) => a.sortOrder - b.sortOrder)
          .map(m => ({ path: m.appRoute, icon: m.icon, label: m.functionName }));
        sessionStorage.setItem(this.NAV_KEY, JSON.stringify(navItems));
        this._navItems$.next(navItems);
      }),
      catchError(err => {
        console.warn('PermissionService: failed to load menus', err);
        return of({ success: false, data: [] });
      })
    );
  }

  // ── Used by PermissionGuard ────────────────────────────────────────
  /**
   * Returns true if the user has been granted AllowMaintView for a route.
   * Dashboard and no-access are always allowed.
   * Admin role bypasses the check — handled in the guard itself.
   */
  isRouteAllowed(url: string): boolean {
    // Normalise: strip query params, leading slash, lowercase
    const norm = '/' + url.replace(/^\//, '').split('?')[0].split('#')[0].toLowerCase();
    if (norm === '/dashboard' || norm === '/no-access' || norm === '/') return true;

    const routes = this.getPermittedRoutes();
    return routes.some(r => {
      const rNorm = r.toLowerCase();
      return norm === rNorm || norm.startsWith(rNorm + '/');
    });
  }

  // ── Helpers ───────────────────────────────────────────────────────
  getPermittedRoutes(): string[] {
    const stored = sessionStorage.getItem(this.ROUTES_KEY);
    return stored ? JSON.parse(stored) : [];
  }

  private restoreFromStorage(): void {
    const nav = sessionStorage.getItem(this.NAV_KEY);
    if (nav) {
      try { this._navItems$.next(JSON.parse(nav)); } catch { /* ignore */ }
    }
  }

  clearMenus(): void {
    sessionStorage.removeItem(this.ROUTES_KEY);
    sessionStorage.removeItem(this.NAV_KEY);
    this._navItems$.next([]);
  }

  // ── Permission-page API calls ─────────────────────────────────────
  getUsers(): Observable<{ success: boolean; data: UserListItem[] }> {
    return this.http.get<any>(`${this.base}/users`);
  }

  getUserPermissions(userId: number): Observable<{ success: boolean; data: UserPermissionRow[] }> {
    return this.http.get<any>(`${this.base}/${userId}`);
  }

  savePermissions(req: SavePermissionsRequest): Observable<{ success: boolean; message: string }> {
    return this.http.post<any>(`${this.base}/save`, req);
  }
}
