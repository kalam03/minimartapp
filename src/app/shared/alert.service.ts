// alert.service.ts
import { Injectable, ComponentRef, ApplicationRef, createComponent, EnvironmentInjector, inject } from '@angular/core';
import { AlertComponent } from './alert.component';
// 'shared' is registered as a global scope in app.config.ts (provideTranslocoScope('shared')),
// so it's already loaded here even though AlertService is providedIn: 'root'.
import { TranslocoService } from '@jsverse/transloco';

export interface AlertOptions {
  type: 'success' | 'error' | 'warning' | 'info' | 'confirm';
  title: string;
  message: string;
  confirmText?: string;
  cancelText?: string;
  duration?: number;
  showCancel?: boolean;
}

@Injectable({
  providedIn: 'root'
})
export class AlertService {
  private alertComponentRef: ComponentRef<AlertComponent> | null = null;
  private transloco = inject(TranslocoService);

  constructor(private appRef: ApplicationRef, private injector: EnvironmentInjector) {}

  // Only used as a *default* when a caller doesn't pass an explicit
  // title/button text — callers that pass their own English string (the
  // majority of existing `alertService.success('Product added')` call
  // sites across the feature modules) are unaffected and are exactly what
  // still needs migrating to transloco keys module-by-module.
  private t(key: string): string {
    return this.transloco.translate(`shared.${key}`);
  }

  private show(options: AlertOptions): Promise<boolean> {
    return new Promise((resolve) => {
      // Remove existing alert if any
      this.destroy();
      
      // Create component
      const componentRef = createComponent(AlertComponent, {
        environmentInjector: this.injector,
      });
      
      // Set inputs
      componentRef.instance.type = options.type;
      componentRef.instance.title = options.title;
      componentRef.instance.message = options.message;
      componentRef.instance.confirmText = options.confirmText || this.t('buttons.ok');
      componentRef.instance.cancelText = options.cancelText || this.t('buttons.cancel');
      componentRef.instance.duration = options.duration || 3000;
      componentRef.instance.showCancel = options.showCancel || false;
      
      // Handle events
      componentRef.instance.confirm.subscribe(() => {
        resolve(true);
        this.destroy();
      });
      
      componentRef.instance.cancel.subscribe(() => {
        resolve(false);
        this.destroy();
      });
      
      // Attach to DOM
      document.body.appendChild(componentRef.location.nativeElement);
      this.appRef.attachView(componentRef.hostView);
      this.alertComponentRef = componentRef;
    });
  }

  success(message: string, title?: string, duration: number = 3000): Promise<boolean> {
    return this.show({
      type: 'success',
      title: title ?? this.t('messages.success'),
      message,
      duration,
      showCancel: false
    });
  }

  error(message: string, title?: string, duration: number = 3000): Promise<boolean> {
    return this.show({
      type: 'error',
      title: title ?? this.t('messages.error'),
      message,
      duration,
      showCancel: false
    });
  }

  warning(message: string, title?: string, duration: number = 3000): Promise<boolean> {
    return this.show({
      type: 'warning',
      title: title ?? this.t('messages.warning'),
      message,
      duration,
      showCancel: false
    });
  }

  info(message: string, title?: string, duration: number = 3000): Promise<boolean> {
    return this.show({
      type: 'info',
      title: title ?? this.t('messages.info'),
      message,
      duration,
      showCancel: false
    });
  }

  confirm(message: string, title?: string, confirmText?: string, cancelText?: string): Promise<boolean> {
    return this.show({
      type: 'confirm',
      title: title ?? this.t('messages.confirmTitle'),
      message,
      confirmText: confirmText ?? this.t('buttons.confirm'),
      cancelText: cancelText ?? this.t('buttons.cancel'),
      showCancel: true
    });
  }

  private destroy(): void {
    if (this.alertComponentRef) {
      this.appRef.detachView(this.alertComponentRef.hostView);
      this.alertComponentRef.destroy();
      this.alertComponentRef = null;
    }
  }
}