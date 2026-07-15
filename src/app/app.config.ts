// app.config.ts
import { ApplicationConfig, isDevMode, inject, provideAppInitializer } from '@angular/core';
import { provideRouter } from '@angular/router';
import { provideHttpClient, withInterceptors } from '@angular/common/http';
import { provideTransloco, provideTranslocoScope } from '@jsverse/transloco';
import { routes } from './app.routes';
import { authInterceptor } from './services/auth.interceptor.fn';
import { languageInterceptor } from './services/language.interceptor.fn';
import { provideServiceWorker } from '@angular/service-worker';
import { AppConfigService } from './services/app-config.service';
import { TranslocoHttpLoader } from './services/transloco-loader';
import { BnGlobalTextDigitsService } from './shared/bn-global-text-digits.service';

export const appConfig: ApplicationConfig = {
  providers: [
    // Must run before anything else gets a chance to read environment.baseUrl
    // — see AppConfigService for why (runtime-configurable API URL, no rebuild
    // needed to change it after deploy).
    provideAppInitializer(() => inject(AppConfigService).load()),
    // Global Bangla-digit display for read-only numeric text app-wide (grid
    // cells, totals, badges, IDs — anything not going through
    // BnNumberAccessorDirective/FinancialInputComponent). See the service
    // for how; no per-component wiring needed for this half either.
    provideAppInitializer(() => inject(BnGlobalTextDigitsService).init()),
    provideRouter(routes),
    provideHttpClient(
      withInterceptors([authInterceptor, languageInterceptor])
    ),
    // English/Bangla — see Multilingual_Localization_Architecture.md.
    // Each feature declares its own scope via provideTranslocoScope('<name>')
    // (see layout.component.ts for 'shared', dashboard/products/pos-billing
    // components for their own) instead of one shared JSON growing forever.
    provideTransloco({
      config: {
        availableLangs: ['en', 'bn'],
        defaultLang: 'en',
        fallbackLang: 'en',
        reRenderOnLangChange: true,
        prodMode: !isDevMode(),
      },
      loader: TranslocoHttpLoader,
    }),
    // 'shared' is used app-wide (layout/nav, buttons, validation, AlertService
    // defaults) including from root-provided services, so — unlike feature
    // scopes such as 'dashboard'/'products'/'pos-billing', which are declared
    // per-component so they're only fetched when that route loads — it's
    // registered globally here instead of on LayoutComponent.
    provideTranslocoScope('shared'),
    provideServiceWorker('ngsw-worker.js', {
      enabled: !isDevMode(),
      registrationStrategy: 'registerWhenStable:30000'
    })
  ]
};