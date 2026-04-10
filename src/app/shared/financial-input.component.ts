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
      [placeholder]="placeholder"
      [class]="className"
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
  
  displayValue: string = '0.00';
  private value: number = 0;
  private onChange: any = () => {};
  private onTouched: any = () => {};

  writeValue(value: number): void {
    this.value = value || 0;
    this.displayValue = this.value.toFixed(2);
  }

  registerOnChange(fn: any): void {
    this.onChange = fn;
  }

  registerOnTouched(fn: any): void {
    this.onTouched = fn;
  }

  onInput(event: any): void {
    this.displayValue = event.target.value;
    let numValue = parseFloat(this.displayValue);
    if (isNaN(numValue)) {
      numValue = 0;
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
    this.displayValue = this.value.toFixed(2);
    this.onTouched();
  }
}