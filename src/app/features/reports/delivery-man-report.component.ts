import { Component, OnInit, ChangeDetectorRef } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { TranslocoModule, TranslocoService, provideTranslocoScope } from '@jsverse/transloco';
import {
  ReportsService,
  DeliveryManCollectionSummaryDto,
  InvoiceReportDto
} from '../../services/reports.service';
import { toLocalDateString } from '../../shared/date-utils';
import { downloadBlob } from '../../shared/pdf-export.util';

@Component({
  selector: 'app-delivery-man-report',
  standalone: true,
  imports: [CommonModule, FormsModule, TranslocoModule],
  providers: [provideTranslocoScope('reports')],
  templateUrl: './delivery-man-report.component.html',
  styleUrls: ['./delivery-man-report.component.css']
})
export class DeliveryManReportComponent implements OnInit {

  fromDate = toLocalDateString();
  toDate   = toLocalDateString();
  activeQuick: string = 'today';

  rows: DeliveryManCollectionSummaryDto[] = [];
  totalDeliveryMen = 0;
  totalCollected   = 0;
  totalDue         = 0;

  isLoading   = false;
  isExporting = false;
  errorMsg    = '';

  //Detail modal state
  showDetail       = false;
  detailLoading    = false;
  detailExporting  = false;
  detailError      = '';
  detailName       = '';
  detailCode       = '';
  detailStatement: InvoiceReportDto[] = [];

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

    this.reportsService.getDeliveryManSummary(this.fromDate, this.toDate).subscribe({
      next: (res) => {
        this.rows             = res.success ? res.data : [];
        this.totalDeliveryMen = res.success ? res.totalDeliveryMen : 0;
        this.totalCollected   = res.success ? res.totalCollected : 0;
        this.totalDue         = res.success ? res.totalDue : 0;
        this.isLoading         = false;
        this.cdr.detectChanges();
      },
      error: (err) => {
        this.rows      = [];
        this.errorMsg  = err?.error?.message || this.t('deliveryManReport.errors.load');
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
    this.reportsService.getDeliveryManSummaryPdf(this.fromDate, this.toDate).subscribe({
      next: (blob) => {
        downloadBlob(blob, `Delivery-Man-Summary_${this.fromDate}_to_${this.toDate}.pdf`);
        this.isExporting = false;
        this.cdr.detectChanges();
      },
      error: (err) => {
        this.errorMsg     = err?.error?.message || this.t('deliveryManReport.errors.pdf');
        this.isExporting = false;
        this.cdr.detectChanges();
      }
    });
  }

  viewDetail(row: DeliveryManCollectionSummaryDto): void {
    this.showDetail      = true;
    this.detailLoading    = true;
    this.detailError      = '';
    this.detailStatement  = [];
    this.detailName       = row.deliveryManName;
    this.detailCode       = row.deliveryManCode;
    this.cdr.detectChanges();

    this.reportsService.getDeliveryManDetail(row.deliveryManCode, this.fromDate, this.toDate).subscribe({
      next: (res) => {
        this.detailStatement = res.success ? res.data : [];
        this.detailName      = res.deliveryManName || row.deliveryManName;
        this.detailLoading   = false;
        this.cdr.detectChanges();
      },
      error: (err) => {
        this.detailError   = err?.error?.message || this.t('deliveryManReport.errors.detail');
        this.detailLoading = false;
        this.cdr.detectChanges();
      }
    });
  }

  closeDetail(): void {
    this.showDetail = false;
    this.detailStatement = [];
  }

  exportDetailPdf(): void {
    if (!this.detailCode) return;
    this.detailExporting = true;
    this.reportsService.getDeliveryManDetailPdf(this.detailCode, this.fromDate, this.toDate).subscribe({
      next: (blob) => {
        downloadBlob(blob, `Delivery-Man-Statement_${this.detailName}_${this.fromDate}_to_${this.toDate}.pdf`);
        this.detailExporting = false;
        this.cdr.detectChanges();
      },
      error: (err) => {
        this.detailError     = err?.error?.message || this.t('deliveryManReport.errors.pdf');
        this.detailExporting = false;
        this.cdr.detectChanges();
      }
    });
  }

  get detailTotalPaid(): number {
    return this.detailStatement.reduce((sum, r) => sum + (r.paidAmount || 0), 0);
  }

  get detailTotalDue(): number {
    return this.detailStatement.reduce((sum, r) => sum + (r.dueAmount || 0), 0);
  }
}
