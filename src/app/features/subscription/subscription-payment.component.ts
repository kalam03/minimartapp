import { Component, OnInit, ChangeDetectorRef } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { ActivatedRoute, Router } from '@angular/router';
import { SubscriptionService, SubscriptionPlan, PaymentMethod } from '../../services/subscription.service';
import { AuthService } from '../../services/auth.service';
import { AlertService } from '../../shared/alert.service';

interface MethodOption {
  id: PaymentMethod;
  label: string;
  color: string;
  kind: 'wallet' | 'card';
}

/**
 * Payment method page — reached from subscription-renew.component's
 * "Renew Now" (no planId, keeps current plan) or "Choose This Plan"
 * (?planId=X) buttons. Shows method tiles (bKash/Nagad/Rocket/Card);
 * picking one swaps in the matching form. No real payment gateway is
 * wired up (see SubscriptionService.Checkout on the backend) — this
 * collects just enough to look and feel real, then activates the plan
 * immediately. Card payments only ever keep the last 4 digits in memory
 * long enough to send to the backend; the full number/CVV are never
 * transmitted or stored.
 */
@Component({
  selector: 'app-subscription-payment',
  standalone: true,
  imports: [CommonModule, FormsModule],
  templateUrl: './subscription-payment.component.html',
  styleUrls: ['./subscription-payment.component.css']
})
export class SubscriptionPaymentComponent implements OnInit {
  methods: MethodOption[] = [
    { id: 'bKash',  label: 'bKash',  color: '#E2136E', kind: 'wallet' },
    { id: 'Nagad',  label: 'Nagad',  color: '#F5821F', kind: 'wallet' },
    { id: 'Rocket', label: 'Rocket', color: '#8C3494', kind: 'wallet' },
    { id: 'Card',   label: 'Visa / Card', color: '#1A1F71', kind: 'card' },
  ];

  selectedMethod: MethodOption | null = null;

  planId: number | null = null;
  targetPlan: SubscriptionPlan | null = null;

  // Wallet form
  mobileNumber = '';

  // Card form
  cardNumber = '';
  cardExpiry = '';
  cardCvv = '';
  cardName = '';

  isLoading = true;
  isSubmitting = false;
  errorMsg = '';

  constructor(
    private subscriptionService: SubscriptionService,
    private authService: AuthService,
    private alertService: AlertService,
    private route: ActivatedRoute,
    private router: Router,
    private cdr: ChangeDetectorRef
  ) {}

  ngOnInit(): void {
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
          // Renewing the current plan — match it by planCode from /subscription/my.
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

  selectMethod(m: MethodOption): void {
    this.selectedMethod = m;
    this.errorMsg = '';
  }

  changeMethod(): void {
    this.selectedMethod = null;
    this.errorMsg = '';
  }

  payWithWallet(): void {
    if (!/^01[3-9]\d{8}$/.test(this.mobileNumber)) {
      this.errorMsg = 'Enter a valid 11-digit mobile number (e.g. 01712345678).';
      return;
    }
    this.submit({
      planId: this.planId ?? undefined,
      paymentMethod: this.selectedMethod!.id,
      accountNumber: this.mobileNumber
    });
  }

  payWithCard(): void {
    const digitsOnly = this.cardNumber.replace(/\s+/g, '');
    if (digitsOnly.length < 12 || digitsOnly.length > 19) {
      this.errorMsg = 'Enter a valid card number.';
      return;
    }
    if (!/^\d{2}\/\d{2}$/.test(this.cardExpiry)) {
      this.errorMsg = 'Enter expiry as MM/YY.';
      return;
    }
    if (!/^\d{3,4}$/.test(this.cardCvv)) {
      this.errorMsg = 'Enter a valid CVV.';
      return;
    }
    if (!this.cardName.trim()) {
      this.errorMsg = 'Enter the name on the card.';
      return;
    }

    this.submit({
      planId: this.planId ?? undefined,
      paymentMethod: 'Card',
      cardLast4: digitsOnly.slice(-4)
    });

    // Clear sensitive fields from memory immediately after building the
    // request — they were never sent anywhere beyond the last-4 digits.
    this.cardNumber = '';
    this.cardCvv = '';
  }

  private submit(payload: Parameters<SubscriptionService['checkout']>[0]): void {
    this.isSubmitting = true;
    this.errorMsg = '';
    this.subscriptionService.checkout(payload).subscribe({
      next: (res) => {
        this.isSubmitting = false;
        this.authService.markSubscriptionActive();
        const d = res.data;
        this.alertService.success(
          `Paid ${d.currency} ${d.amount} for ${d.planName}. Active until ${new Date(d.newEndDate).toLocaleDateString()}.`,
          'Payment Successful'
        );
        this.router.navigate(['/dashboard']);
      },
      error: (err) => {
        this.isSubmitting = false;
        this.errorMsg = err?.error?.message || 'Payment failed. Please try again.';
        this.cdr.detectChanges();
      }
    });
  }

  back(): void {
    this.router.navigate(['/subscription/renew']);
  }
}
