import { Component, OnInit, ChangeDetectorRef } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { TranslocoModule, TranslocoService, provideTranslocoScope } from '@jsverse/transloco';
import {
  ReportsService,
  SupplierPaymentMethodSummaryDto,
  SupplierReportDetailDto
} from '../../services/reports.service';
import { toLocalDateString } from '../../shared/date-utils';
import { downloadBlob } from '../../shared/pdf-export.util';

//Purchase-side mirror of DeliveryManReportComponent. Purchases has no employee/handler column (unlike Sales.DeliveryManCode),
//so this groups by Supplier instead — same payment-method breakdown, reusing the Supplier Report's detail endpoint for drill-down.
@Component({
  selector: 'app-purchase-payment-report',
  standalone: true,
  imports: [CommonModule, FormsModule, TranslocoModule],
  providers: [provideTranslocoScope('reports')],
  templateUrl: './purchase-payment-report.component.html',
  styleUrls: ['./purchase-payment-report.component.css']
})
export class PurchasePaymentReportComponent implements OnInit {

  fromDate = toLocalDateString();
  toDate   = toLocalDateString();
  activeQuick: string = 'today';

  rows: SupplierPaymentMethodSummaryDto[] = [];
  totalSuppliers = 0;
  totalPaid      = 0;
  totalDue       = 0;

  isLoading   = false;
  isExporting = false;
  errorMsg    = '';

  //Detail modal state — reuses SupplierReportDetailDto shape (currentDue + Statement) from the Supplier Report endpoint
  showDetail      = false;
  detailLoading   = false;
  detailExporting = false;
  detailError     = '';
  detail: SupplierReportDetailDto | null = null;

  constructor(
    private reportsService: ReportsService,
    private cdr: ChangeDetectorRef,
    private transloco: TranslocoService
  ) {}

  private t(key: string, params?: Record<string, unknown>): string {
    return this.transloco.translate(`reports.${key}`, params);
  }

  ngOnInit(): void {
    this.loadReport();
  }

  loadReport(): void {
    this.isLoading = true;
    this.errorMsg  = '';

    this.reportsService.getPurchasePaymentSummary(this.fromDate, this.toDate).subscribe({
      next: (res) => {
        this.rows           = res.success ? res.data : [];
        this.totalSuppliers = res.success ? res.totalSuppliers : 0;
        this.totalPaid      = res.success ? res.totalPaid : 0;
        this.totalDue        = res.success ? res.totalDue : 0;
        this.isLoading       = false;
        this.cdr.detectChanges();
      },
      error: (err) => {
        this.rows      = [];
        this.errorMsg  = err?.error?.message || this.t('purchasePaymentReport.errors.load');
        this.isLoading = false;
        this.cdr.detectChanges();
      }
    });
  }

  applyFilter(): void {
    this.activeQuick = '';
    this.loadReport();
  }

  resetFilter(): void {
    this.applyQuick('today');
  }

  applyQuick(period: string): void {
    const today    = new Date();
    const todayStr = toLocalDateString(today);

    switch (period) {
      case 'today':
        this.fromDate = todayStr;
        this.toDate   = todayStr;
        break;
      case 'month': {
        const d = new Date(today.getFullYear(), today.getMonth(), 1);
        this.fromDate = toLocalDateString(d);
        this.toDate   = todayStr;
        break;
      }
      case 'quarter': {
        const d = new Date(today.getFullYear(), Math.floor(today.getMonth() / 3) * 3, 1);
        this.fromDate = toLocalDateString(d);
        this.toDate   = todayStr;
        break;
      }
      case 'year': {
        const d = new Date(today.getFullYear(), 0, 1);
        this.fromDate = toLocalDateString(d);
        this.toDate   = todayStr;
        break;
      }
      default: return;
    }

    this.activeQuick = period;
    this.loadReport();
  }

  exportPdf(): void {
    this.isExporting = true;
    this.reportsService.getPurchasePaymentSummaryPdf(this.fromDate, this.toDate).subscribe({
      next: (blob) => {
        downloadBlob(blob, `Purchase-Payment-Summary_${this.fromDate}_to_${this.toDate}.pdf`);
        this.isExporting = false;
        this.cdr.detectChanges();
      },
      error: (err) => {
        this.errorMsg     = err?.error?.message || this.t('purchasePaymentReport.errors.pdf');
        this.isExporting = false;
        this.cdr.detectChanges();
      }
    });
  }

  viewDetail(supplierId: number): void {
    this.showDetail    = true;
    this.detailLoading = true;
    this.detailError   = '';
    this.detail        = null;
    this.cdr.detectChanges();

    this.reportsService.getSupplierDetail(supplierId, this.fromDate, this.toDate).subscribe({
      next: (res) => {
        this.detail        = res.success ? res.data : null;
        this.detailLoading = false;
        this.cdr.detectChanges();
      },
      error: (err) => {
        this.detailError   = err?.error?.message || this.t('purchasePaymentReport.errors.detail');
        this.detailLoading = false;
        this.cdr.detectChanges();
      }
    });
  }

  closeDetail(): void {
    this.showDetail = false;
    this.detail      = null;
  }

  exportDetailPdf(): void {
    if (!this.detail) return;
    this.detailExporting = true;
    this.reportsService.getSupplierDetailPdf(this.detail.supplierId, this.fromDate, this.toDate).subscribe({
      next: (blob) => {
        downloadBlob(blob, `Supplier-Statement_${this.detail!.supplierName}_${this.fromDate}_to_${this.toDate}.pdf`);
        this.detailExporting = false;
        this.cdr.detectChanges();
      },
      error: (err) => {
        this.detailError     = err?.error?.message || this.t('purchasePaymentReport.errors.pdf');
        this.detailExporting = false;
        this.cdr.detectChanges();
      }
    });
  }

  get statementTotalNet(): number {
    return (this.detail?.statement || []).reduce((sum, r) => sum + (r.netAmount || 0), 0);
  }

  get statementTotalPaid(): number {
    return (this.detail?.statement || []).reduce((sum, r) => sum + (r.paidAmount || 0), 0);
  }
}
