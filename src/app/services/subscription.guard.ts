import { inject } from '@angular/core';
import { CanActivateFn, Router } from '@angular/router';

/**
 * Bounces a tenant whose subscription has lapsed back to the self-service
 * renewal page instead of letting them into the app shell.
 *
 * Reads a cache written by AuthService.finishLoginAndRedirect() (at login
 * time) and SubscriptionRenewComponent (after a successful renew), rather
 * than calling the API on every navigation — cheap, and consistent with the
 * existing 'enabled_modules'/'permitted_routes' caching pattern (see
 * ModuleGuard, PermissionGuard).
 *
 * NOTE: this is a UX layer only — a tenant who never navigates away from an
 * already-open tab keeps using their existing token/session until it
 * expires, same caveat as the rest of the client-side guards. Real
 * enforcement for that case would mean wiring up the (currently inert)
 * SubscriptionValidationMiddleware server-side.
 */
export const SubscriptionGuard: CanActivateFn = () => {
  const router = inject(Router);

  const status = sessionStorage.getItem('subscription_status');
  if (status === 'Expired') {
    return router.createUrlTree(['/subscription/renew']);
  }

  return true; // no cached status, or Trial/Active/anything else — let it through
};
