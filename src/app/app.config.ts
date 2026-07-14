// app.config.ts
import { ApplicationConfig, isDevMode, inject, provideAppInitializer } from '@angular/core';
import { provideRouter } from '@angular/router';
import { provideHttpClient, withInterceptors } from '@angular/common/http';
import { routes } from './app.routes';
import { authInterceptor } from './services/auth.interceptor.fn';
import { provideServiceWorker } from '@angular/service-worker';
import { AppConfigService } from './services/app-config.service';

export const appConfig: ApplicationConfig = {
  providers: [
    // Must run before anything else gets a chance to read environment.baseUrl
    // — see AppConfigService for why (runtime-configurable API URL, no rebuild
    // needed to change it after deploy).
    provideAppInitializer(() => inject(AppConfigService).load()),
    provideRouter(routes),
    provideHttpClient(
      withInterceptors([authInterceptor])
    ),
    provideServiceWorker('ngsw-worker.js', {
      enabled: !isDevMode(),
      registrationStrategy: 'registerWhenStable:30000'
    })
  ]
};