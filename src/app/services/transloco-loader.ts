// services/transloco-loader.ts
import { Injectable, inject } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Translation, TranslocoLoader } from '@jsverse/transloco';

// Transloco calls getTranslation('en') for the unscoped/root language and
// getTranslation('<scope>/en') for anything requesting a scope via
// provideTranslocoScope('<scope>') (see LanguageService + any feature
// component using the `transloco` pipe). Either way the path already
// matches our folder layout: assets/i18n/<scope>/<lang>.json,
// assets/i18n/<lang>.json for the (currently unused) root scope.
@Injectable({ providedIn: 'root' })
export class TranslocoHttpLoader implements TranslocoLoader {
  private http = inject(HttpClient);

  getTranslation(lang: string) {
    return this.http.get<Translation>(`assets/i18n/${lang}.json`);
  }
}
