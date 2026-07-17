import { Component, OnInit, ChangeDetectorRef } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { TranslocoModule, TranslocoService, provideTranslocoScope } from '@jsverse/transloco';
import { ReportsService, PaymentMethodSummaryDto } from '../../services/reports.service';
import { paymentMethodLabelKey } from '../../shared/payment-methods';
import { downloadBlob } from '../../shared/pdf-export.util';

@Component({
  selector: 'app-payment-method-summary-report',
  standalone: true,
  imports: [CommonModule, FormsModule, TranslocoModule],
  // Provided directly on this component too (in addition to the parent
  // ReportsHubComponent) — same pattern as the other 4 report tabs.
  providers: [provideTranslocoScope('reports')],
  templateUrl: './payment-method-summary-report.component.html',
  styleUrls: ['./payment-method-summary-report.component.css']
})
export class PaymentMethodSummaryReportComponent implements OnInit {

  // ── Optional date range — unlike the other reports, blank means "all
  // time" (a running balance, not a period total), so nothing defaults
  // to today here. ─────────────────────────────────────────────────────
  fromDate: string | null = null;
  toDate: string | null = null;
  activeQuick: string = 'allTime';

  rows: PaymentMethodSummaryDto[] = [];
  isLoading   = false;
  isExporting = false;
  errorMsg    = '';

  get totalBalance(): number {
    return this.rows.reduce((sum, r) => sum + r.balance, 0);
  }

  get totalIn(): number {
    return this.rows.reduce((sum, r) => sum + r.totalIn, 0);
  }

  get totalOut(): number {
    return this.rows.reduce((sum, r) => sum + r.totalOut, 0);
  }

  constructor(
    private reportsService: ReportsService,
    private cdr: ChangeDetectorRef,
    private transloco: TranslocoService
  ) {}

  /** Shorthand for the 'reports' scope — provided by ReportsHubComponent. */
  private t(key: string, params?: Record<string, unknown>): string {
    return this.transloco.translate(`reports.${key}`, params);
  }

  /** Reuses the same canonical label mapping every other payment-method
   *  dropdown uses (see shared/payment-methods.ts) — cash/bkash/nagad/
   *  rocket/bank account share one translation everywhere in the app. */
  methodLabelKey(method: string): string {
    return paymentMethodLabelKey(method) || method;
  }

  ngOnInit(): void {
    this.loadReport();
  }

  loadReport(): void {
    this.isLoading = true;
    this.errorMsg  = '';
    this.reportsService.getPaymentMethodSummary(this.fromDate, this.toDate).subscribe({
      next: (res) => {
        if (res.success) this.rows = res.data;
        this.isLoading = false;
        this.cdr.detectChanges();
      },
      error: (err) => {
        this.errorMsg  = err?.error?.message || this.t('paymentMethodSummary.errors.load');
        this.isLoading = false;
        this.cdr.detectChanges();
      }
    });
  }

  applyFilter(): void {
    this.activeQuick = '';   // manual date edit clears the "All Time" pill
    this.loadReport();
  }

  resetFilter(): void {
    this.fromDate = null;
    this.toDate   = null;
    this.activeQuick = 'allTime';
    this.loadReport();
  }

  exportPdf(): void {
    this.isExporting = true;
    this.reportsService.getPaymentMethodSummaryPdf(this.fromDate, this.toDate).subscribe({
      next: (blob) => {
        const suffix = (this.fromDate || this.toDate)
          ? `${this.fromDate ?? 'start'}_to_${this.toDate ?? 'now'}`
          : 'AllTime';
        downloadBlob(blob, `Payment-Method-Summary_${suffix}.pdf`);
        this.isExporting = false;
        this.cdr.detectChanges();
      },
      error: (err) => {
        this.errorMsg  = err?.error?.message || this.t('paymentMethodSummary.errors.pdf');
        this.isExporting = false;
        this.cdr.detectChanges();
      }
    });
  }
}
