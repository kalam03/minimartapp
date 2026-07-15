// shared/payment-methods.ts
//
// Canonical "Payment Method" list shared by every transaction-recording page
// — Payroll (salary/bonus/advance), Counter/POS Billing, Purchases, and
// Capital Management. Previously each page hardcoded its own list, and they
// had drifted apart (different items, different casing: 'Cash' vs 'cash',
// missing bKash/Nagad/Rocket on some pages, etc). This is the single source
// of truth going forward — add or rename a method here once, every page
// picks it up automatically.
//
// Values are lowercase (per instruction) and are exactly what's stored/sent
// to the backend — existing historical records saved under older values
// ('Bank', 'credit', 'Mobile Banking', ...) are untouched, this only changes
// what's offered going forward.
//
// Only the *displayed* label is translated (see paymentMethodLabelKey below)
// via the app-wide 'shared' Transloco scope (already loaded globally, so no
// per-feature i18n file needs its own copy of these strings anymore).
export interface PaymentMethodOption {
  value: string;
  labelKey: string;
}

export const PAYMENT_METHODS: readonly PaymentMethodOption[] = [
  { value: 'cash', labelKey: 'shared.paymentMethods.cash' },
  { value: 'bkash', labelKey: 'shared.paymentMethods.bkash' },
  { value: 'nagad', labelKey: 'shared.paymentMethods.nagad' },
  { value: 'rocket', labelKey: 'shared.paymentMethods.rocket' },
  { value: 'bank account', labelKey: 'shared.paymentMethods.bankAccount' },
];

/** Default payment method for new forms/resets across all pages. */
export const DEFAULT_PAYMENT_METHOD = 'cash';

/**
 * Translation key for a stored payment-method value. Falls back to showing
 * the raw value untranslated if it's an older/unknown value (e.g. a
 * historical record saved before this list existed) rather than hiding it.
 */
export function paymentMethodLabelKey(value: string | null | undefined): string {
  if (!value) return '';
  const found = PAYMENT_METHODS.find(m => m.value === value);
  return found ? found.labelKey : value;
}
