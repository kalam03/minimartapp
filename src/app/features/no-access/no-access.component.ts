import { Component } from '@angular/core';
import { CommonModule } from '@angular/common';
import { Router } from '@angular/router';

@Component({
  selector: 'app-no-access',
  standalone: true,
  imports: [CommonModule],
  template: `
    <div class="min-h-screen flex items-center justify-center" style="background:#f5f6fa">
      <div class="bg-white rounded-2xl shadow-xl border p-10 max-w-md w-full text-center">

        <!-- Lock icon -->
        <div class="flex items-center justify-center w-20 h-20 rounded-full mx-auto mb-5"
             style="background:#f0f2fb">
          <svg class="w-10 h-10" fill="none" stroke="#1a1c4e" viewBox="0 0 24 24">
            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="1.8"
              d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6
                 a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z"/>
          </svg>
        </div>

        <!-- Heading -->
        <h1 class="text-2xl font-bold mb-1" style="color:#1a1c4e">Access Denied</h1>
        <p class="text-sm text-gray-500 mb-6">
          You don't have permission to view this page.<br>
          Contact your administrator to request access.
        </p>

        <!-- Error code badge -->
        <div class="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-semibold mb-8"
             style="background:#e0e3f8;color:#1a1c4e">
          <svg class="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2"
              d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z"/>
          </svg>
          Error 403 — Forbidden
        </div>

        <!-- Back to dashboard -->
        <button
          (click)="goToDashboard()"
          class="w-full py-2.5 rounded-xl text-sm font-semibold text-white transition"
          style="background:#1a1c4e"
          onmouseover="this.style.background='#252862'"
          onmouseout="this.style.background='#1a1c4e'"
        >
          ← Back to Dashboard
        </button>
      </div>
    </div>
  `
})
export class NoAccessComponent {
  constructor(private router: Router) {}
  goToDashboard(): void { this.router.navigate(['/dashboard']); }
}
