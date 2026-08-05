import { inject } from '@angular/core';
import { CanActivateFn, Router } from '@angular/router';

// UX-only guard: reads cached subscription_status for an instant client-side redirect; SubscriptionValidationMiddleware is the real, server-side enforcement (this just avoids a round trip to discover the same 402).
export const SubscriptionGuard: CanActivateFn = () => {
  const router = inject(Router);

  const status = sessionStorage.getItem('subscription_status');
  if (status === 'PendingVerification') {
    return router.createUrlTree(['/subscription/pending-verification']);
  }
  if (status === 'Expired' || status === 'Suspended' || status === 'Cancelled') {
    return router.createUrlTree(['/subscription/renew']);
  }

  return true; // no cached status, or Trial/Active/anything else — let it through
};
