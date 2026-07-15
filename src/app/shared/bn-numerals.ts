// shared/bn-numerals.ts
//
// Pure, framework-free helpers for converting between English (ASCII) and
// Bangla digit glyphs, plus a sanitizer that keeps a typed numeric string
// well-formed (single leading '-', single '.', digits only).
//
// These are intentionally free of Angular imports so they can be unit
// tested in isolation and reused from the ControlValueAccessor directive,
// the display pipe, or anywhere else (e.g. a future PDF/report generator).

const EN_DIGITS = ['0', '1', '2', '3', '4', '5', '6', '7', '8', '9'];
const BN_DIGITS = ['০', '১', '২', '৩', '৪', '৫', '৬', '৭', '৮', '৯'];

const EN_TO_BN_RE = /[0-9]/g;
const BN_TO_EN_RE = /[০-৯]/g;

/** "123" -> "১২৩". Non-digit characters (., -, spaces, ৳, etc.) pass through untouched. */
export function enToBn(input: string): string {
  if (!input) return input;
  return input.replace(EN_TO_BN_RE, (d) => BN_DIGITS[EN_DIGITS.indexOf(d)]);
}

/** "১২৩" -> "123". Non-digit characters pass through untouched. */
export function bnToEn(input: string): string {
  if (!input) return input;
  return input.replace(BN_TO_EN_RE, (d) => EN_DIGITS[BN_DIGITS.indexOf(d)]);
}

/**
 * Keeps a user-typed numeric string well-formed while they're still typing:
 * - at most one leading '-' (negative numbers)
 * - at most one '.' (decimal point)
 * - digits only otherwise
 * Any other character (letters, extra dots/minuses, pasted junk) is dropped.
 * Input is expected to already be digit-normalized to English (0-9).
 */
export function sanitizeNumericString(raw: string): string {
  let out = '';
  let seenDot = false;
  for (let i = 0; i < raw.length; i++) {
    const ch = raw[i];
    if (ch === '-' && i === 0) {
      out += ch;
    } else if (ch === '.' && !seenDot) {
      seenDot = true;
      out += ch;
    } else if (ch >= '0' && ch <= '9') {
      out += ch;
    }
    // else: drop the character silently
  }
  return out;
}

/** '' | '-' | '.' | '-.'  -> null (nothing numeric typed yet); otherwise parseFloat. */
export function parseSanitizedNumber(sanitized: string): number | null {
  if (sanitized === '' || sanitized === '-' || sanitized === '.' || sanitized === '-.') {
    return null;
  }
  const n = parseFloat(sanitized);
  return Number.isNaN(n) ? null : n;
}
