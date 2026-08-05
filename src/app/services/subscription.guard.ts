import { inject } from '@angular/core';
import { CanActivateFn, Router } from '@angular/router';

// UX-only guard: reads cached subscription_status; real enforcement needs server-side SubscriptionValidationMiddleware.
export const SubscriptionGuard: CanActivateFn = () => {
  const router = inject(Router);

  const status = sessionStorage.getItem('subscription_status');
  if (status === 'Expired') {
    return router.createUrlTree(['/subscription/renew']);
  }

  return true; // no cached status, or Trial/Active/anything else — let it through
};
