import { Component, OnInit, ChangeDetectorRef } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { TranslocoModule, TranslocoService, provideTranslocoScope } from '@jsverse/transloco';
import {
  ReportsService,
  SupplierPurchaseSummaryDto,
  SupplierReportDetailDto
} from '../../services/reports.service';
import { toLocalDateString } from '../../shared/date-utils';
import { downloadBlob } from '../../shared/pdf-export.util';

@Component({
  selector: 'app-supplier-report',
  standalone: true,
  imports: [CommonModule, FormsModule, TranslocoModule],
  providers: [provideTranslocoScope('reports')],
  templateUrl: './supplier-report.component.html',
  styleUrls: ['./supplier-report.component.css']
})
export class SupplierReportComponent implements OnInit {

  fromDate = toLocalDateString();
  toDate   = toLocalDateString();
  activeQuick: string = 'today';

  //"above" -> minAmount, "below" -> maxAmount; empty amountValue means no threshold at all
  amountMode: 'above' | 'below' = 'above';
  amountValue: number | '' = '';

  rows: SupplierPurchaseSummaryDto[] = [];
  totalSuppliers = 0;
  totalAmount    = 0;

  isLoading   = false;
  isExporting = false;
  errorMsg    = '';

  //Detail modal state
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

  private get minAmount(): number | null {
    return this.amountMode === 'above' && this.amountValue !== '' ? Number(this.amountValue) : null;
  }

  private get maxAmount(): number | null {
    return this.amountMode === 'below' && this.amountValue !== '' ? Number(this.amountValue) : null;
  }

  loadReport(): void {
    this.isLoading = true;
    this.errorMsg  = '';

    this.reportsService.getSupplierPurchaseSummary(this.fromDate, this.toDate, this.minAmount, this.maxAmount).subscribe({
      next: (res) => {
        this.rows           = res.success ? res.data : [];
        this.totalSuppliers = res.success ? res.totalSuppliers : 0;
        this.totalAmount    = res.success ? res.totalAmount : 0;
        this.isLoading      = false;
        this.cdr.detectChanges();
      },
      error: (err) => {
        this.rows      = [];
        this.errorMsg  = err?.error?.message || this.t('supplierReport.errors.load');
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
    this.amountValue = '';
    this.amountMode  = 'above';
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
    this.reportsService.getSupplierPurchaseSummaryPdf(this.fromDate, this.toDate, this.minAmount, this.maxAmount).subscribe({
      next: (blob) => {
        downloadBlob(blob, `Supplier-Purchase-Summary_${this.fromDate}_to_${this.toDate}.pdf`);
        this.isExporting = false;
        this.cdr.detectChanges();
      },
      error: (err) => {
        this.errorMsg     = err?.error?.message || this.t('supplierReport.errors.pdf');
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
        this.detailError   = err?.error?.message || this.t('supplierReport.errors.detail');
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
        this.detailError     = err?.error?.message || this.t('supplierReport.errors.pdf');
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
