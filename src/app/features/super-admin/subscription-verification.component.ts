import { Component, OnInit, ChangeDetectorRef } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { RouterLink } from '@angular/router';
import { SuperAdminService } from '../../services/super-admin.service';
import { PendingPayment } from '../../services/subscription.service';
import { AlertService } from '../../shared/alert.service';

/**
 * Super Admin — Subscription Verification. Manual review queue for Send
 * Money payments (bKash/Nagad/Rocket/Bank) submitted from the tenant-facing
 * Payment page — there's no merchant account/gateway, so every payment sits
 * as "Pending" until a SuperAdmin checks their own bKash/Nagad/Rocket/bank
 * statement for the reported Transaction ID and either Verifies (which
 * applies the plan change/renewal and unblocks the tenant) or Rejects it.
 *
 * Not linked from the regular sidebar, same reasoning as TenantManagementComponent.
 */
@Component({
  selector: 'app-subscription-verification',
  standalone: true,
  imports: [CommonModule, FormsModule, RouterLink],
  templateUrl: './subscription-verification.component.html',
  styleUrls: ['./subscription-verification.component.css']
})
export class SubscriptionVerificationComponent implements OnInit {
  payments: PendingPayment[] = [];
  isLoading = false;
  errorMsg = '';
  processingId: number | null = null;

  constructor(
    private superAdminService: SuperAdminService,
    private alertService: AlertService,
    private cdr: ChangeDetectorRef
  ) {}

  ngOnInit(): void {
    this.load();
  }

  load(): void {
    this.isLoading = true;
    this.errorMsg = '';
    this.superAdminService.getPendingPayments().subscribe({
      next: (res) => {
        this.payments = res.success ? res.data : [];
        this.isLoading = false;
        this.cdr.detectChanges();
      },
      error: (err) => {
        this.payments = [];
        this.errorMsg = err?.error?.message || 'Failed to load pending payments';
        this.isLoading = false;
        this.cdr.detectChanges();
      }
    });
  }

  async verify(p: PendingPayment): Promise<void> {
    const confirmed = await this.alertService.confirm(
      `Confirm you've checked your ${p.paymentMethod} / bank statement and found TrxID "${p.transactionRef}" for ${p.currency} ${p.amount} from "${p.tenantName}". Verify this payment and activate their subscription?`,
      'Verify Payment'
    );
    if (!confirmed) return;

    this.processingId = p.paymentId;
    this.superAdminService.verifyPayment(p.paymentId).subscribe({
      next: () => {
        this.processingId = null;
        this.alertService.success(`Payment verified — ${p.tenantName}'s subscription is now active.`);
        this.load();
      },
      error: (err) => {
        this.processingId = null;
        this.alertService.error('Failed to verify: ' + (err.error?.message || err.message));
        this.cdr.detectChanges();
      }
    });
  }

  reject(p: PendingPayment): void {
    const reason = window.prompt(`Reason for rejecting ${p.tenantName}'s payment (shown to the tenant):`) || '';

    this.processingId = p.paymentId;
    this.superAdminService.rejectPayment(p.paymentId, reason).subscribe({
      next: () => {
        this.processingId = null;
        this.alertService.success('Payment rejected');
        this.load();
      },
      error: (err) => {
        this.processingId = null;
        this.alertService.error('Failed to reject: ' + (err.error?.message || err.message));
        this.cdr.detectChanges();
      }
    });
  }
}
