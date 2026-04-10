// financial-input.component.ts
import { Component, forwardRef, Input } from '@angular/core';
import { ControlValueAccessor, NG_VALUE_ACCESSOR } from '@angular/forms';

@Component({
  selector: 'app-financial-input',
  standalone: true,
  template: `
    <input
      type="text"
      [value]="displayValue"
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
  
  displayValue: string = '0.00';
  private value: number = 0;
  private onChange: any = () => {};
  private onTouched: any = () => {};

  writeValue(value: number): void {
    this.value = value || 0;
    this.displayValue = this.value.toFixed(this.decimalPlaces);
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
    
    // Prevent non-numeric characters
    if (!allowedKeys.includes(event.key) && !event.key.match(/[0-9]/)) {
      event.preventDefault();
    }
    
    // Prevent multiple decimal points
    if (event.key === '.' || event.key === 'Decimal') {
      const currentValue = (event.target as HTMLInputElement).value;
      if (currentValue.includes('.')) {
        event.preventDefault();
      }
    }
  }

  onInput(event: any): void {
    let rawValue = event.target.value;
    
    // Allow empty string
    if (rawValue === '') {
      this.displayValue = '';
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
    this.onChange(numValue);
  }

  onFocus(): void {
    if (this.value === 0) {
      this.displayValue = '';
    } else {
      this.displayValue = this.value.toString();
    }
  }

  onBlur(): void {
    // Format with proper decimal places
    this.displayValue = this.value.toFixed(this.decimalPlaces);
    this.onTouched();
  }
}