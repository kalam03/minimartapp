import { Component, OnInit, ChangeDetectorRef } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { ActivatedRoute, Router } from '@angular/router';
import { SubscriptionService, SubscriptionPlan } from '../../services/subscription.service';
import { AppConfigService, PaymentMethodConfig } from '../../services/app-config.service';
import { AuthService } from '../../services/auth.service';
import { AlertService } from '../../shared/alert.service';

//No merchant account/gateway - the tenant sends money to a personal bKash/Nagad/Rocket/bank account (numbers + instructions come from config.json via AppConfigService) and reports the TrxID here. This only submits a Pending payment request; a SuperAdmin must verify it before the plan actually activates (see SubscriptionVerification page).
@Component({
  selector: 'app-subscription-payment',
  standalone: true,
  imports: [CommonModule, FormsModule],
  templateUrl: './subscription-payment.component.html',
  styleUrls: ['./subscription-payment.component.css']
})
export class SubscriptionPaymentComponent implements OnInit {
  methods: PaymentMethodConfig[] = [];
  selectedMethod: PaymentMethodConfig | null = null;

  planId: number | null = null;
  targetPlan: SubscriptionPlan | null = null;

  transactionId = '';
  senderAccountNumber = '';

  isLoading = true;
  isSubmitting = false;
  errorMsg = '';

  constructor(
    private subscriptionService: SubscriptionService,
    private appConfig: AppConfigService,
    private authService: AuthService,
    private alertService: AlertService,
    private route: ActivatedRoute,
    private router: Router,
    private cdr: ChangeDetectorRef
  ) {}

  ngOnInit(): void {
    this.methods = this.appConfig.paymentMethods;

    const planIdParam = this.route.snapshot.queryParamMap.get('planId');
    this.planId = planIdParam ? Number(planIdParam) : null;

    this.subscriptionService.getPlans().subscribe({
      next: (res) => {
        const plans = res.success ? res.data : [];

        if (this.planId) {
          this.targetPlan = plans.find(p => p.planId === this.planId) || null;
          this.isLoading = false;
          this.cdr.detectChanges();
        } else {
          this.subscriptionService.getMySubscription().subscribe({
            next: (subRes) => {
              const code = subRes.success ? subRes.data.planCode : null;
              this.targetPlan = plans.find(p => p.planCode === code) || null;
              this.isLoading = false;
              this.cdr.detectChanges();
            },
            error: () => { this.isLoading = false; this.cdr.detectChanges(); }
          });
        }
      },
      error: (err) => {
        this.errorMsg = err?.error?.message || 'Failed to load plan details';
        this.isLoading = false;
        this.cdr.detectChanges();
      }
    });
  }

  selectMethod(m: PaymentMethodConfig): void {
    this.selectedMethod = m;
    this.errorMsg = '';
  }

  changeMethod(): void {
    this.selectedMethod = null;
    this.transactionId = '';
    this.senderAccountNumber = '';
    this.errorMsg = '';
  }

  submit(): void {
    if (!this.transactionId.trim()) {
      this.errorMsg = 'Enter the Transaction ID from your payment confirmation.';
      return;
    }

    this.isSubmitting = true;
    this.errorMsg = '';
    this.subscriptionService.submitPaymentRequest({
      planId: this.planId ?? undefined,
      paymentMethod: this.selectedMethod!.id,
      transactionId: this.transactionId.trim(),
      senderAccountNumber: this.senderAccountNumber.trim() || undefined
    }).subscribe({
      next: () => {
        this.isSubmitting = false;
        this.authService.markSubscriptionPending();
        this.alertService.success(
          "Payment submitted! We'll verify it and activate your subscription shortly.",
          'Submitted for Verification'
        );
        this.router.navigate(['/subscription/pending-verification']);
      },
      error: (err) => {
        this.isSubmitting = false;
        this.errorMsg = err?.error?.message || 'Could not submit payment. Please try again.';
        this.cdr.detectChanges();
      }
    });
  }

  back(): void {
    this.router.navigate(['/subscription/renew']);
  }
}
