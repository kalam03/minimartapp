import { Component, OnInit, ChangeDetectorRef } from '@angular/core';
import { CommonModule } from '@angular/common';
import { Router } from '@angular/router';
import { SubscriptionService, SubscriptionPayment } from '../../services/subscription.service';
import { AuthService } from '../../services/auth.service';

//Landing page for a tenant whose Send Money payment is still awaiting SuperAdmin verification - SubscriptionGuard/finishLoginAndRedirect route here whenever the JWT's subscriptionStatus claim is "PendingVerification" (see subscription-payment.component.ts for how the payment gets submitted).
@Component({
  selector: 'app-subscription-pending',
  standalone: true,
  imports: [CommonModule],
  templateUrl: './subscription-pending.component.html',
  styleUrls: ['./subscription-pending.component.css']
})
export class SubscriptionPendingComponent implements OnInit {
  latestPayment: SubscriptionPayment | null = null;
  isLoading = true;
  isRefreshing = false;

  constructor(
    private subscriptionService: SubscriptionService,
    private authService: AuthService,
    private router: Router,
    private cdr: ChangeDetectorRef
  ) {}

  ngOnInit(): void {
    this.load();
  }

  private load(): void {
    this.subscriptionService.getMyPayments().subscribe({
      next: (res) => {
        const payments = res.success ? res.data : [];
        this.latestPayment = payments.length > 0 ? payments[0] : null;
        this.isLoading = false;
        this.isRefreshing = false;
        this.cdr.detectChanges();
      },
      error: () => {
        this.isLoading = false;
        this.isRefreshing = false;
        this.cdr.detectChanges();
      }
    });
  }

  //A verified/rejected payment doesn't unblock this browser session by itself (the old JWT still carries the stale claim) - re-logging in issues a fresh token with the current status
  refresh(): void {
    this.isRefreshing = true;
    this.load();
  }

  submitAnotherPayment(): void {
    this.router.navigate(['/subscription/payment']);
  }

  logout(): void {
    this.authService.logout();
  }
}
