// alert.component.ts
import { Component, Input, Output, EventEmitter, OnInit, OnDestroy, HostListener } from '@angular/core';
import { CommonModule } from '@angular/common';

@Component({
  selector: 'app-alert',
  standalone: true,
  imports: [CommonModule],
  template: `
    <div *ngIf="visible" class="fixed inset-0 z-50 flex items-center justify-center p-4" (click)="onOverlayClick($event)">
      <!-- Backdrop -->
      <div class="fixed inset-0 transition-all" style="background:rgba(26,28,78,0.45); backdrop-filter:blur(2px)"></div>

      <!-- Modal -->
      <div class="relative w-full max-w-sm rounded-2xl overflow-hidden shadow-2xl"
           style="background:#fff; border:1.5px solid #e0e3f8; animation: alertFadeIn 0.18s ease">

        <!-- Top accent bar -->
        <div class="h-1 w-full" [style.background]="getAccentColor()"></div>

        <!-- Body -->
        <div class="px-6 pt-5 pb-4">
          <div class="flex items-start gap-4">

            <!-- Icon bubble -->
            <div class="flex-shrink-0 w-11 h-11 rounded-xl flex items-center justify-center"
                 [style.background]="getIconBg()" [style.color]="getIconColor()">
              <svg *ngIf="type === 'success'" class="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2.5" d="M5 13l4 4L19 7"/>
              </svg>
              <svg *ngIf="type === 'error'" class="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2.5" d="M6 18L18 6M6 6l12 12"/>
              </svg>
              <svg *ngIf="type === 'warning'" class="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z"/>
              </svg>
              <svg *ngIf="type === 'info'" class="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z"/>
              </svg>
              <svg *ngIf="type === 'confirm'" class="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M8.228 9c.549-1.165 2.03-2 3.772-2 2.21 0 4 1.343 4 3 0 1.4-1.278 2.575-3.006 2.907-.542.104-.994.54-.994 1.093m0 3h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z"/>
              </svg>
            </div>

            <!-- Text -->
            <div class="flex-1 min-w-0 pt-0.5">
              <h3 class="text-sm font-bold" style="color:#1a1c4e">{{ title }}</h3>
              <p class="mt-1 text-sm whitespace-pre-line" style="color:#4b5563">{{ message }}</p>
            </div>

          </div>
        </div>

        <!-- Footer -->
        <div class="px-6 pb-5 flex gap-2 justify-end" style="border-top:1px solid #f0f2fb; padding-top:12px">
          <button *ngIf="showCancel"
            (click)="onCancel()"
            class="px-4 py-2 text-sm font-medium rounded-lg transition-all outline-none"
            style="background:#f0f2fb; color:#1a1c4e; border:1.5px solid #e0e3f8"
            onmouseover="this.style.background='#e0e3f8'"
            onmouseout="this.style.background='#f0f2fb'">
            {{ cancelText }}
          </button>
          <button
            (click)="onConfirm()"
            class="px-4 py-2 text-sm font-semibold text-white rounded-lg transition-all outline-none"
            [style.background]="confirmHover ? getAccentHover() : getAccentColor()"
            (mouseenter)="confirmHover = true"
            (mouseleave)="confirmHover = false">
            {{ confirmText }}
          </button>
        </div>
      </div>
    </div>

    <style>
      @keyframes alertFadeIn {
        from { opacity: 0; transform: scale(0.96) translateY(8px); }
        to   { opacity: 1; transform: scale(1) translateY(0); }
      }
    </style>
  `
})
export class AlertComponent implements OnInit, OnDestroy {
  @Input() type: 'success' | 'error' | 'warning' | 'info' | 'confirm' = 'info';
  @Input() title: string = '';
  @Input() message: string = '';
  @Input() confirmText: string = 'OK';
  @Input() cancelText: string = 'Cancel';
  @Input() duration: number = 3000;
  @Input() showCancel: boolean = false;
  @Output() confirm = new EventEmitter<void>();
  @Output() cancel = new EventEmitter<void>();

  visible: boolean = false;
  confirmHover: boolean = false;
  private timeoutId: any;

  ngOnInit(): void {
    this.visible = true;
    if (this.type !== 'confirm' && this.duration > 0) {
      this.timeoutId = setTimeout(() => this.close(), this.duration);
    }
  }

  ngOnDestroy(): void {
    if (this.timeoutId) clearTimeout(this.timeoutId);
  }

  @HostListener('document:keydown.enter', ['$event'])
  handleEnterKey(event: Event): void {
    if (this.visible) {
      (event as KeyboardEvent).preventDefault();
      this.onConfirm();
    }
  }

  @HostListener('document:keydown.escape', ['$event'])
  handleEscapeKey(event: Event): void {
    if (this.visible) {
      (event as KeyboardEvent).preventDefault();
      this.showCancel ? this.onCancel() : this.onConfirm();
    }
  }

  getAccentColor(): string {
    switch (this.type) {
      case 'success': return '#10b981';
      case 'error':   return '#ef4444';
      case 'warning': return '#f59e0b';
      case 'info':    return '#1a1c4e';
      case 'confirm': return '#252862';
      default:        return '#1a1c4e';
    }
  }

  getAccentHover(): string {
    switch (this.type) {
      case 'success': return '#059669';
      case 'error':   return '#dc2626';
      case 'warning': return '#d97706';
      case 'info':    return '#252862';
      case 'confirm': return '#1a1c4e';
      default:        return '#252862';
    }
  }

  getIconBg(): string {
    switch (this.type) {
      case 'success': return '#d1fae5';
      case 'error':   return '#fee2e2';
      case 'warning': return '#fef3c7';
      case 'info':    return '#e0e3f8';
      case 'confirm': return '#e0e3f8';
      default:        return '#e0e3f8';
    }
  }

  getIconColor(): string {
    switch (this.type) {
      case 'success': return '#065f46';
      case 'error':   return '#b91c1c';
      case 'warning': return '#b45309';
      case 'info':    return '#1a1c4e';
      case 'confirm': return '#252862';
      default:        return '#1a1c4e';
    }
  }

  onConfirm(): void {
    this.confirm.emit();
    this.close();
  }

  onCancel(): void {
    this.cancel.emit();
    this.close();
  }

  onOverlayClick(event: MouseEvent): void {
    if ((event.target as HTMLElement).classList.contains('fixed')) {
      this.close();
    }
  }

  close(): void {
    this.visible = false;
  }
}
