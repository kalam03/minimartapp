import { inject } from '@angular/core';
import { CanActivateFn, Router, ActivatedRouteSnapshot } from '@angular/router';
import { AuthService } from './auth.service';
import { SubscriptionService } from './subscription.service';

// OPT-IN, not applied to any route yet — UX-only guard (real enforcement is server-side); requires an 'enabled_modules' cache populated at login, otherwise fails safe (denies).
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

  // No cache yet — fail safe (deny); populate via subSvc.getMyModules() at login under 'enabled_modules'.
  void subSvc; // kept to silence unused-var lint until cache population is wired in
  return router.createUrlTree(['/no-access']);
};
