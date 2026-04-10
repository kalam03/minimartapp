// alert.service.ts
import { Injectable, ComponentRef, ApplicationRef, createComponent, EnvironmentInjector } from '@angular/core';
import { AlertComponent } from './alert.component';

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

  constructor(private appRef: ApplicationRef, private injector: EnvironmentInjector) {}

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
      componentRef.instance.confirmText = options.confirmText || 'OK';
      componentRef.instance.cancelText = options.cancelText || 'Cancel';
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

  success(message: string, title: string = 'Success', duration: number = 3000): Promise<boolean> {
    return this.show({
      type: 'success',
      title,
      message,
      duration,
      showCancel: false
    });
  }

  error(message: string, title: string = 'Error', duration: number = 3000): Promise<boolean> {
    return this.show({
      type: 'error',
      title,
      message,
      duration,
      showCancel: false
    });
  }

  warning(message: string, title: string = 'Warning', duration: number = 3000): Promise<boolean> {
    return this.show({
      type: 'warning',
      title,
      message,
      duration,
      showCancel: false
    });
  }

  info(message: string, title: string = 'Information', duration: number = 3000): Promise<boolean> {
    return this.show({
      type: 'info',
      title,
      message,
      duration,
      showCancel: false
    });
  }

  confirm(message: string, title: string = 'Confirm', confirmText: string = 'Confirm', cancelText: string = 'Cancel'): Promise<boolean> {
    return this.show({
      type: 'confirm',
      title,
      message,
      confirmText,
      cancelText,
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