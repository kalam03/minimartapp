// financial-input.component.ts
import { Component, forwardRef, Input, inject } from '@angular/core';
import { ControlValueAccessor, NG_VALUE_ACCESSOR } from '@angular/forms';
import { LanguageService } from '../services/language.service';
import { bnToEn, enToBn } from './bn-numerals';

@Component({
  selector: 'app-financial-input',
  standalone: true,
  template: `
    <input
      type="text"
      inputmode="decimal"
      [value]="renderedValue"
      (input)="onInput($event)"
      (focus)="onFocus()"
      (blur)="onBlur()"
      (keydown)="onKeyDown($event)"
      [placeholder]="placeholder"
      [class]="className"
      [readonly]="readonly"
    />
  `,
  providers: [
    {
      provide: NG_VALUE_ACCESSOR,
      useExisting: forwardRef(() => FinancialInputComponent),
      multi: true
    }
  ]
})
export class FinancialInputComponent implements ControlValueAccessor {
  @Input() placeholder: string = '0.00';
  @Input() className: string = '';
  @Input() readonly: boolean = false;
  @Input() allowNegative: boolean = false;
  @Input() maxValue: number = Infinity;
  @Input() minValue: number = 0;
  @Input() decimalPlaces: number = 2;

  private readonly languageService = inject(LanguageService);

  /** Always English digits internally — only rendering (below) localizes them. */
  displayValue: string = '0.00';
  private value: number = 0;
  /** True while the user has this field focused/actively typing. */
  private focused = false;
  private onChange: any = () => {};
  private onTouched: any = () => {};

  private isBangla(): boolean {
    return this.languageService.currentLanguage() === 'bn';
  }

  /** What the native input actually shows — Bangla digits when the app is in Bangla.
   *  Reads the language signal, so this re-evaluates automatically (and the
   *  [value] binding above re-renders) the instant the user switches language,
   *  even while this field isn't focused. */
  get renderedValue(): string {
    return this.isBangla() ? enToBn(this.displayValue) : this.displayValue;
  }

  writeValue(value: number): void {
    this.value = value || 0;
    // Skip reformatting while the user is actively typing. [(ngModel)] round-trips
    // every keystroke back through here (onChange updates the parent's bound
    // property, Angular sees it "changed" and calls writeValue back), so without
    // this guard every digit typed got immediately overwritten by the formatted
    // "X.00" string — which is why only the first digit ever seemed to register.
    if (!this.focused) {
      this.displayValue = this.value.toFixed(this.decimalPlaces);
    }
  }

  registerOnChange(fn: any): void {
    this.onChange = fn;
  }

  registerOnTouched(fn: any): void {
    this.onTouched = fn;
  }

  // Prevent invalid characters
  onKeyDown(event: KeyboardEvent): void {
    const allowedKeys = [
      'Backspace', 'Delete', 'Tab', 'Escape', 'Enter',
      'ArrowLeft', 'ArrowRight', 'ArrowUp', 'ArrowDown',
      'Home', 'End', '0', '1', '2', '3', '4', '5', '6', '7', '8', '9',
      'Period', 'Decimal'
    ];

    // Allow negative sign if enabled
    if (this.allowNegative && event.key === '-') {
      return;
    }

    // Prevent non-numeric characters (English digits, or Bangla digits typed
    // directly via a Bangla keyboard layout, are both allowed through).
    const isEnglishDigit = /^[0-9]$/.test(event.key);
    const isBanglaDigit = /^[০-৯]$/.test(event.key);
    if (!allowedKeys.includes(event.key) && !isEnglishDigit && !isBanglaDigit) {
      event.preventDefault();
    }

    // Prevent multiple decimal points
    if (event.key === '.' || event.key === 'Decimal') {
      const currentValue = bnToEn((event.target as HTMLInputElement).value);
      if (currentValue.includes('.')) {
        event.preventDefault();
      }
    }
  }

  onInput(event: any): void {
    const target = event.target as HTMLInputElement;
    const cursorPos = target.selectionStart ?? target.value.length;

    // Normalize any Bangla digits the user just typed/pasted back to English
    // before running the existing (unchanged) sanitization logic below.
    let rawValue = bnToEn(target.value);

    // Allow empty string — actually clear the field AND tell the parent the
    // value is now 0 (previously this returned without calling onChange, so
    // the bound model kept its old value; then onBlur reformatted the empty
    // box back to that old value, making the field look impossible to clear).
    if (rawValue === '') {
      this.displayValue = '';
      this.value = 0;
      this.onChange(0);
      return;
    }

    // Remove any non-numeric characters except decimal point and negative sign
    let cleanedValue = rawValue.replace(/[^0-9.-]/g, '');

    // Handle negative sign
    if (this.allowNegative) {
      const negativeCount = (cleanedValue.match(/-/g) || []).length;
      if (negativeCount > 1) {
        cleanedValue = cleanedValue.replace(/-/g, '');
      }
      if (cleanedValue.startsWith('-') && cleanedValue.length > 1) {
        cleanedValue = '-' + cleanedValue.replace(/-/g, '');
      }
    } else {
      cleanedValue = cleanedValue.replace(/-/g, '');
    }

    // Handle decimal places
    const parts = cleanedValue.split('.');
    if (parts.length > 2) {
      cleanedValue = parts[0] + '.' + parts.slice(1).join('');
    }

    // Limit decimal places
    if (parts.length === 2 && parts[1].length > this.decimalPlaces) {
      cleanedValue = parts[0] + '.' + parts[1].substring(0, this.decimalPlaces);
    }

    this.displayValue = cleanedValue;

    // Parse to number
    let numValue = parseFloat(cleanedValue);
    if (isNaN(numValue)) {
      numValue = 0;
    }

    // Apply min/max constraints
    if (numValue < this.minValue) {
      numValue = this.minValue;
      this.displayValue = numValue.toString();
    }
    if (numValue > this.maxValue) {
      numValue = this.maxValue;
      this.displayValue = numValue.toString();
    }

    this.value = numValue;

    // Re-render immediately in the active script and restore the caret —
    // without this, Angular's [value] binding wouldn't reformat until the
    // next change-detection tick, and even then would jump the cursor to
    // the end (digit-glyph swap looks like "new text" to the browser).
    const rendered = this.isBangla() ? enToBn(this.displayValue) : this.displayValue;
    if (target.value !== rendered) {
      const shift = target.value.length - rendered.length;
      target.value = rendered;
      const newPos = Math.max(0, cursorPos - shift);
      target.setSelectionRange(newPos, newPos);
    }

    this.onChange(numValue);
  }

  onFocus(): void {
    this.focused = true;
    if (this.value === 0) {
      this.displayValue = '';
    } else {
      this.displayValue = this.value.toString();
    }
  }

  onBlur(): void {
    this.focused = false;
    // Format with proper decimal places
    this.displayValue = this.value.toFixed(this.decimalPlaces);
    this.onTouched();
  }
}