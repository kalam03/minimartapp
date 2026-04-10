// alert.component.ts
import { Component, Input, Output, EventEmitter, OnInit, OnDestroy } from '@angular/core';
import { CommonModule } from '@angular/common';

@Component({
  selector: 'app-alert',
  standalone: true,
  imports: [CommonModule],
  template: `
    <div *ngIf="visible" class="fixed inset-0 z-50 overflow-y-auto" (click)="onOverlayClick($event)">
      <!-- Backdrop with blur effect -->
      <div class="fixed inset-0 backdrop-blur-md bg-white/30 transition-all"></div>
      
      <!-- Alert Modal -->
      <div class="flex min-h-full items-center justify-center p-4">
        <div class="relative transform overflow-hidden rounded-lg bg-white shadow-2xl transition-all sm:w-full sm:max-w-md animate-in fade-in zoom-in duration-200">
          <!-- Icon and Content -->
          <div class="p-6">
            <div class="flex items-start gap-4">
              <!-- Icon -->
              <div class="flex-shrink-0">
                <div [class]="getIconContainerClass()">
                  <svg class="h-6 w-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path *ngIf="type === 'success'" stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M5 13l4 4L19 7" />
                    <path *ngIf="type === 'error'" stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M6 18L18 6M6 6l12 12" />
                    <path *ngIf="type === 'warning'" stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
                    <path *ngIf="type === 'info'" stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                    <path *ngIf="type === 'confirm'" stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M8.228 9c.549-1.165 2.03-2 3.772-2 2.21 0 4 1.343 4 3 0 1.4-1.278 2.575-3.006 2.907-.542.104-.994.54-.994 1.093m0 3h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                  </svg>
                </div>
              </div>
              
              <!-- Content -->
              <div class="flex-1">
                <h3 class="text-lg font-semibold text-gray-900">{{ title }}</h3>
                <p class="mt-2 text-sm text-gray-600 whitespace-pre-line">{{ message }}</p>
              </div>
            </div>
          </div>
          
          <!-- Buttons -->
          <div class="bg-gray-50 px-6 py-3 flex gap-3 justify-end">
            <button *ngIf="showCancel" 
              (click)="onCancel()"
              class="px-4 py-2 text-sm font-medium text-gray-700 bg-white border border-gray-300 rounded-lg hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-gray-500 transition-colors">
              {{ cancelText }}
            </button>
            <button 
              (click)="onConfirm()"
              [class]="getButtonClass()"
              class="px-4 py-2 text-sm font-medium text-white rounded-lg focus:outline-none focus:ring-2 focus:ring-offset-2 transition-colors">
              {{ confirmText }}
            </button>
          </div>
        </div>
      </div>
    </div>
  `,
  styles: [`
    @keyframes fadeIn {
      from {
        opacity: 0;
        transform: scale(0.95);
      }
      to {
        opacity: 1;
        transform: scale(1);
      }
    }
    
    .animate-in {
      animation: fadeIn 0.2s ease-out;
    }
  `]
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
  private timeoutId: any;

  ngOnInit(): void {
    this.visible = true;
    
    // Auto close for non-confirm alerts
    if (this.type !== 'confirm' && this.duration > 0) {
      this.timeoutId = setTimeout(() => {
        this.close();
      }, this.duration);
    }
  }

  ngOnDestroy(): void {
    if (this.timeoutId) {
      clearTimeout(this.timeoutId);
    }
  }

  getIconContainerClass(): string {
    const baseClass = 'rounded-full p-2';
    switch (this.type) {
      case 'success':
        return `${baseClass} bg-green-100 text-green-600`;
      case 'error':
        return `${baseClass} bg-red-100 text-red-600`;
      case 'warning':
        return `${baseClass} bg-yellow-100 text-yellow-600`;
      case 'info':
        return `${baseClass} bg-blue-100 text-blue-600`;
      case 'confirm':
        return `${baseClass} bg-purple-100 text-purple-600`;
      default:
        return `${baseClass} bg-blue-100 text-blue-600`;
    }
  }

  getButtonClass(): string {
    switch (this.type) {
      case 'success':
        return 'bg-green-600 hover:bg-green-700 focus:ring-green-500';
      case 'error':
        return 'bg-red-600 hover:bg-red-700 focus:ring-red-500';
      case 'warning':
        return 'bg-yellow-600 hover:bg-yellow-700 focus:ring-yellow-500';
      case 'info':
        return 'bg-blue-600 hover:bg-blue-700 focus:ring-blue-500';
      case 'confirm':
        return 'bg-purple-600 hover:bg-purple-700 focus:ring-purple-500';
      default:
        return 'bg-blue-600 hover:bg-blue-700 focus:ring-blue-500';
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
    // Close only if clicking the backdrop
    if ((event.target as HTMLElement).classList.contains('fixed')) {
      this.close();
    }
  }

  close(): void {
    this.visible = false;
    setTimeout(() => {
      // Component will be removed by parent
    }, 150);
  }
}