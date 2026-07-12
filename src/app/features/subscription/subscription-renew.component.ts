import { Component, OnInit, ChangeDetectorRef } from '@angular/core';
import { CommonModule } from '@angular/common';
import { Router } from '@angular/router';
import { SubscriptionService, ActiveSubscription, SubscriptionPlan } from '../../services/subscription.service';
import { AuthService } from '../../services/auth.service';
import { AlertService } from '../../shared/alert.service';

/**
 * Gate page a tenant lands on when their subscription has expired —
 * SubscriptionGuard redirects here instead of the dashboard (see
 * app.routes.ts / subscription.guard.ts). They can renew their current
 * plan or pick a different one; either action activates the tenant
 * immediately (no payment gateway wired up yet — same trust model as
 * trial signup) and sends them on to the dashboard. They can also just
 * log out from here if they'd rather come back later.
 */
@Component({
  selector: 'app-subscription-renew',
  standalone: true,
  imports: [CommonModule],
  templateUrl: './subscription-renew.component.html',
  styleUrls: ['./subscription-renew.component.css']
})
export class SubscriptionRenewComponent implements OnInit {
  mySubscription: ActiveSubscription | null = null;
  plans: SubscriptionPlan[] = [];

  isLoading = true;
  isSubmitting = false;
  errorMsg = '';

  constructor(
    private subscriptionService: SubscriptionService,
    private authService: AuthService,
    private alertService: AlertService,
    private router: Router,
    private cdr: ChangeDetectorRef
  ) {}

  ngOnInit(): void {
    this.subscriptionService.getMySubscription().subscribe({
      next: (res) => { this.mySubscription = res.success ? res.data : null; this.cdr.detectChanges(); },
      error: () => { /* fine if this fails — the plan list below still works */ }
    });

    this.subscriptionService.getPlans().subscribe({
      next: (res) => {
        this.plans = res.success ? res.data : [];
        this.isLoading = false;
        this.cdr.detectChanges();
      },
      error: (err) => {
        this.errorMsg = err?.error?.message || 'Failed to load plans';
        this.isLoading = false;
        this.cdr.detectChanges();
      }
    });
  }

  renewCurrentPlan(): void {
    this.isSubmitting = true;
    this.subscriptionService.renew(1).subscribe({
      next: () => this.onSuccess('Subscription renewed'),
      error: (err) => this.onError(err)
    });
  }

  choosePlan(plan: SubscriptionPlan): void {
    this.isSubmitting = true;
    this.subscriptionService.changePlan(plan.planId, false).subscribe({
      next: () => this.onSuccess(`Subscribed to ${plan.planName}`),
      error: (err) => this.onError(err)
    });
  }

  private onSuccess(message: string): void {
    this.isSubmitting = false;
    this.authService.markSubscriptionActive();
    this.alertService.success(message);
    this.router.navigate(['/dashboard']);
  }

  private onError(err: any): void {
    this.isSubmitting = false;
    this.errorMsg = err?.error?.message || 'Something went wrong. Please try again.';
    this.cdr.detectChanges();
  }

  logout(): void {
    this.authService.logout();
  }
}
