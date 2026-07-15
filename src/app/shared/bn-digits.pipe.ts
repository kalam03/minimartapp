// shared/bn-digits.pipe.ts
//
// Optional companion to BnNumberAccessorDirective for *read-only* numeric
// text — table cells, summary badges, printed totals, etc. — that isn't
// bound through ngModel/formControl and so the accessor directive never
// touches it.
//
// Usage: {{ someNumber | number:'1.2-2' | bnDigits }}
// (chain after Angular's own `number`/`currency` pipes so grouping,
// decimals, and currency symbols are computed first — this pipe only
// swaps the digit glyphs at the very end.)
//
// Marked `pure: false` so it re-renders immediately when the user flips
// the language, without requiring every call site to also pass the
// active language in as a second argument.
import { Pipe, PipeTransform, inject } from '@angular/core';
import { LanguageService } from '../services/language.service';
import { enToBn } from './bn-numerals';

@Pipe({
  name: 'bnDigits',
  standalone: true,
  pure: false,
})
export class BnDigitsPipe implements PipeTransform {
  private readonly languageService = inject(LanguageService);

  transform(value: string | number | null | undefined): string {
    if (value === null || value === undefined) return '';
    const str = String(value);
    return this.languageService.currentLanguage() === 'bn' ? enToBn(str) : str;
  }
}
