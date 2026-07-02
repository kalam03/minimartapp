import { inject }           from '@angular/core';
import { CanActivateFn, Router, ActivatedRouteSnapshot, RouterStateSnapshot } from '@angular/router';
import { AuthService }       from './auth.service';
import { PermissionService } from './permission.service';

export const PermissionGuard: CanActivateFn = (
  _route: ActivatedRouteSnapshot,
  state: RouterStateSnapshot
) => {
  const auth    = inject(AuthService);
  const permSvc = inject(PermissionService);
  const router  = inject(Router);

  // Admin role bypasses permission check — they can see everything
  if (auth.isAdmin()) return true;

  if (permSvc.isRouteAllowed(state.url)) return true;

  // No permission — redirect to the access-denied page
  return router.createUrlTree(['/no-access']);
};
