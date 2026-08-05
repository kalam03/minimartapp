import { HttpInterceptorFn } from '@angular/common/http';
import { inject } from '@angular/core';
import { LanguageService } from './language.service';

// Lets the API's LocalizationMiddleware render errors/messages in the UI's current language.
export const languageInterceptor: HttpInterceptorFn = (req, next) => {
  const lang = inject(LanguageService).currentLanguage();
  return next(req.clone({ setHeaders: { 'X-App-Language': lang } }));
};
