// services/language.interceptor.fn.ts
import { HttpInterceptorFn } from '@angular/common/http';
import { inject } from '@angular/core';
import { LanguageService } from './language.service';

// Sends the currently-selected language on every request so the API's
// LocalizationMiddleware (MiniMartApi/Middleware/LocalizationMiddleware.cs)
// can render validation errors, report titles, etc. in the same language
// the UI is showing — without every service call passing it manually.
export const languageInterceptor: HttpInterceptorFn = (req, next) => {
  const lang = inject(LanguageService).currentLanguage();
  return next(req.clone({ setHeaders: { 'X-App-Language': lang } }));
};
