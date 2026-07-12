import { inject } from '@angular/core';
import { CanActivateFn, Router, ActivatedRouteSnapshot } from '@angular/router';
import { AuthService } from './auth.service';
import { SubscriptionService } from './subscription.service';

/**
 * OPT-IN — not applied to any route yet.
 *
 * Blocks navigation to a route whose module the tenant's subscription
 * doesn't currently include. This is a UX layer only (defense in depth) —
 * the real enforcement is server-side (SubscriptionValidationMiddleware +
 * every API endpoint's own tenant/module checks). Never rely on this guard
 * alone for security.
 *
 * To apply once a new vertical module (e.g. School/Pharmacy) is ready:
 *
 *   {
 *     path: 'school/students',
 *     canActivate: [PermissionGuard, ModuleGuard],
 *     data: { requiredModule: 'SCHOOL' },
 *     loadComponent: () => import(...).then(m => m.StudentsComponent),
 *   }
 *
 * Requires the tenant's enabled-module list to be cached client-side after
 * login (e.g. in AuthService, alongside the existing permitted_routes
 * cache) — see SaaS_Platform_Architecture.md Section 5.1/15. Until that
 * cache is populated, this guard fails safe (denies) rather than silently
 * allowing everything through, so wire up the cache before applying it.
 */
export const ModuleGuard: CanActivateFn = (route: ActivatedRouteSnapshot) => {
  const auth   = inject(AuthService);
  const subSvc = inject(SubscriptionService);
  const router = inject(Router);

  const requiredModule = route.data?.['requiredModule'] as string | undefined;
  if (!requiredModule) return true; // no module requirement declared — nothing to check

  if (auth.isAdmin()) return true;

  const cached = sessionStorage.getItem('enabled_modules');
  if (cached) {
    try {
      const modules: string[] = JSON.parse(cached);
      if (modules.includes(requiredModule)) return true;
      return router.createUrlTree(['/no-access']);
    } catch {
      // fall through to fail-safe deny below
    }
  }

  // No cache yet — fail safe (deny) rather than assume access.
  // Call subSvc.getMyModules() at login time and cache the result under
  // 'enabled_modules' to populate this properly.
  void subSvc; // referenced for the wiring note above; remove once cache population is implemented
  return router.createUrlTree(['/no-access']);
};
