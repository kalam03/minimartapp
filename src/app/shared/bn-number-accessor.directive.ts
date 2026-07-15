// shared/bn-number-accessor.directive.ts
//
// Global Bangla-numeral support for numeric inputs.
//
// WHY THIS EXISTS
// Angular's built-in NumberValueAccessor binds `input[type=number]` to a
// plain `number` model value. Native `<input type="number">` elements can
// only ever contain the ASCII characters a browser accepts as a valid
// floating point number — typing or injecting Bangla digits (০১২...) into
// one is rejected outright by the browser, not just by Angular. So genuine
// Bangla-digit display requires the element to become type="text" and for
// something else to take over the number<->string conversion Angular used
// to do for us. That "something else" is this directive.
//
// HOW IT WORKS
// This directive's selector intentionally matches the exact same inputs
// Angular's own NumberValueAccessor targets. When a custom accessor and a
// built-in accessor both match the same host element, Angular's forms
// module prefers the custom one and ignores the built-in — this is the
// standard, supported way to replace value-accessor behavior for a class
// of inputs (the same technique input-masking libraries use). Consumers
// don't need to change their `[(ngModel)]`/template code at all: the
// model still holds a plain `number | null`, exactly as before.
//
// - Display: renders the model's number as English or Bangla digits
//   depending on the active app language (read from LanguageService's
//   `currentLanguage` signal, reactively — flips instantly when the user
//   switches language from the header dropdown, no page reload needed).
// - Input: as the user types (or pastes), Bangla digits are converted back
//   to English, the string is sanitized to a valid decimal/negative number
//   shape (single leading '-', single '.', digits only), the sanitized
//   value is re-rendered in the active script, and the *English* numeric
//   value is pushed into the Angular model — so calculations, validation,
//   and API payloads all continue to see plain English numbers.
// - Cursor position is preserved across the re-render (digit-for-digit
//   substitution doesn't change string length; only genuinely invalid
//   characters shift it, and the shift is compensated for).
//
// ONE-TIME SETUP PER COMPONENT
// Standalone Angular components only see directives listed in their own
// `imports: [...]` array (there is no NgModule-style global registration
// for standalone apps). So this directive must appear in the `imports`
// array of any component whose template has a `type="number"` input —
// that's a one-line addition, done once, already applied across the app's
// existing numeric-input components. Any *new* component with a numeric
// input just needs to add `BnNumberAccessorDirective` to its `imports`
// alongside `FormsModule`; no other change is required.
import {
  Directive,
  ElementRef,
  HostListener,
  Renderer2,
  effect,
  forwardRef,
  inject,
} from '@angular/core';
import { NG_VALUE_ACCESSOR, ControlValueAccessor } from '@angular/forms';
import { LanguageService } from '../services/language.service';
import { bnToEn, enToBn, sanitizeNumericString, parseSanitizedNumber } from './bn-numerals';

@Directive({
  selector:
    'input[type=number][formControlName],input[type=number][formControl],input[type=number][ngModel]',
  standalone: true,
  providers: [
    {
      provide: NG_VALUE_ACCESSOR,
      useExisting: forwardRef(() => BnNumberAccessorDirective),
      multi: true,
    },
  ],
})
export class BnNumberAccessorDirective implements ControlValueAccessor {
  private readonly el = inject(ElementRef<HTMLInputElement>);
  private readonly renderer = inject(Renderer2);
  private readonly languageService = inject(LanguageService);

  /** Last known-good model value (English number), as Angular forms understands it. */
  private rawValue: number | null = null;

  private onChange: (value: number | null) => void = () => {};
  private onTouched: () => void = () => {};

  constructor() {
    // Native type="number" cannot display non-ASCII digits at all — switch
    // to text once, up front, and keep a numeric-friendly mobile keyboard.
    const nativeEl = this.el.nativeElement;
    this.renderer.setAttribute(nativeEl, 'type', 'text');
    if (!nativeEl.hasAttribute('inputmode')) {
      this.renderer.setAttribute(nativeEl, 'inputmode', 'decimal');
    }

    // Re-render the *display* (not the model) the instant the user flips
    // the app language, so already-visible values switch digit systems
    // immediately without needing to re-focus/re-type the field.
    effect(() => {
      this.languageService.currentLanguage();
      this.renderDisplay();
    });
  }

  private isBangla(): boolean {
    return this.languageService.currentLanguage() === 'bn';
  }

  private renderDisplay(): void {
    const display = this.rawValue === null || this.rawValue === undefined
      ? ''
      : String(this.rawValue);
    const localized = this.isBangla() ? enToBn(display) : display;
    this.renderer.setProperty(this.el.nativeElement, 'value', localized);
  }

  // ── ControlValueAccessor ────────────────────────────────────────────
  writeValue(value: number | string | null): void {
    this.rawValue = value === null || value === undefined || value === ('' as any)
      ? null
      : Number(value);
    this.renderDisplay();
  }

  registerOnChange(fn: (value: number | null) => void): void {
    this.onChange = fn;
  }

  registerOnTouched(fn: () => void): void {
    this.onTouched = fn;
  }

  setDisabledState(isDisabled: boolean): void {
    this.renderer.setProperty(this.el.nativeElement, 'disabled', isDisabled);
  }

  // ── DOM events ──────────────────────────────────────────────────────
  @HostListener('input', ['$event'])
  onInput(event: Event): void {
    const target = event.target as HTMLInputElement;
    const typed = target.value;
    const cursorPos = target.selectionStart ?? typed.length;

    const normalizedToEnglish = bnToEn(typed);
    const sanitized = sanitizeNumericString(normalizedToEnglish);
    const displayValue = this.isBangla() ? enToBn(sanitized) : sanitized;

    if (displayValue !== typed) {
      target.value = displayValue;
      // Digit-for-digit substitution preserves length; only stripped
      // invalid characters change it — shift the cursor back by exactly
      // that much so it stays where the user's caret visually was.
      const shift = typed.length - displayValue.length;
      const newPos = Math.max(0, cursorPos - shift);
      target.setSelectionRange(newPos, newPos);
    }

    this.rawValue = parseSanitizedNumber(sanitized);
    this.onChange(this.rawValue);
  }

  @HostListener('blur')
  onBlur(): void {
    this.onTouched();
  }
}
