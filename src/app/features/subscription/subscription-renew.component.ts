import { Component, OnInit, ChangeDetectorRef } from '@angular/core';
import { CommonModule } from '@angular/common';
import { Router } from '@angular/router';
import { SubscriptionService, ActiveSubscription, SubscriptionPlan } from '../../services/subscription.service';
import { AuthService } from '../../services/auth.service';

//Gate page a tenant lands on when their subscription expires - SubscriptionGuard redirects here instead of the dashboard (see subscription.guard.ts)
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
  errorMsg = '';

  constructor(
    private subscriptionService: SubscriptionService,
    private authService: AuthService,
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

  //A tenant with no real TenantSubscriptions row yet (legacy fallback) has nothing to "renew" - they must pick a plan, which creates a fresh row
  get canQuickRenew(): boolean {
    return !!this.mySubscription && this.mySubscription.subscriptionId > 0;
  }

  renewCurrentPlan(): void {
    this.router.navigate(['/subscription/payment']);
  }

  choosePlan(plan: SubscriptionPlan): void {
    this.router.navigate(['/subscription/payment'], { queryParams: { planId: plan.planId } });
  }

  logout(): void {
    this.authService.logout();
  }
}
