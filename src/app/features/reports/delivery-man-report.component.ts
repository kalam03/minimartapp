import { Component, OnInit, ChangeDetectorRef } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { TranslocoModule, TranslocoService, provideTranslocoScope } from '@jsverse/transloco';
import {
  ReportsService,
  DeliveryManCollectionSummaryDto,
  InvoiceReportDto
} from '../../services/reports.service';
import { SaleService, SaleInvoiceDto } from '../../services/sale.service';
import { DeliverySettlementService, DeliverySettlementDto } from '../../services/delivery-settlement.service';
import { AuthService } from '../../services/auth.service';
import { toLocalDateString } from '../../shared/date-utils';
import { downloadBlob } from '../../shared/pdf-export.util';
import { FinancialInputComponent } from '../../shared/financial-input.component';
import { PAYMENT_METHODS, DEFAULT_PAYMENT_METHOD } from '../../shared/payment-methods';

@Component({
  selector: 'app-delivery-man-report',
  standalone: true,
  imports: [CommonModule, FormsModule, TranslocoModule, FinancialInputComponent],
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

  //Invoice-detail modal state (opened from clicking an invoice number inside the delivery-man detail modal above)
  showInvoiceDetail    = false;
  invoiceDetailLoading = false;
  invoiceDetailError   = '';
  invoiceDetail: SaleInvoiceDto | null = null;

  //Delivery Settlement section state, shown inside the invoice-detail modal above (only for sales with a delivery man)
  paymentMethods        = PAYMENT_METHODS;
  settlementLoading     = false;
  settlementError       = '';
  settlementActionBusy  = false;
  settlements: DeliverySettlementDto[] = [];
  settlementForm = {
    collectedAmount: 0,
    collectedMethod: DEFAULT_PAYMENT_METHOD,
    remarks: ''
  };
  disputeRemarksDraft = '';

  constructor(
    private reportsService: ReportsService,
    private saleService: SaleService,
    private deliverySettlementService: DeliverySettlementService,
    private authService: AuthService,
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

  //Opens the second popup showing the full item-level invoice, drilled into from an invoice number inside detailStatement above
  viewInvoice(row: InvoiceReportDto): void {
    this.showInvoiceDetail    = true;
    this.invoiceDetailLoading = true;
    this.invoiceDetailError   = '';
    this.invoiceDetail        = null;
    this.cdr.detectChanges();

    this.settlements    = [];
    this.settlementError = '';
    this.resetSettlementForm();

    this.saleService.getInvoiceDetail(row.saleId).subscribe({
      next: (res) => {
        this.invoiceDetail        = res.success ? res.data : null;
        this.invoiceDetailLoading = false;
        this.cdr.detectChanges();

        if (this.invoiceDetail?.deliveryManCode) {
          this.settlementForm.collectedAmount = this.invoiceDetail.paidAmount || 0;
          this.settlementForm.collectedMethod = this.invoiceDetail.paymentType || DEFAULT_PAYMENT_METHOD;
          this.loadSettlements(row.saleId);
        }
      },
      error: (err) => {
        this.invoiceDetailError   = err?.error?.message || this.t('deliveryManReport.errors.invoiceDetail');
        this.invoiceDetailLoading = false;
        this.cdr.detectChanges();
      }
    });
  }

  closeInvoiceDetail(): void {
    this.showInvoiceDetail = false;
    this.invoiceDetail = null;
    this.settlements = [];
  }

  //The latest submission — a sale can have more than one row if a Disputed submission was later corrected and resubmitted
  get latestSettlement(): DeliverySettlementDto | null {
    return this.settlements.length ? this.settlements[0] : null;
  }

  //A fresh submission form should show when there's nothing yet, or the last attempt was thrown out as Disputed
  get showSettlementForm(): boolean {
    return !this.latestSettlement || this.latestSettlement.status === 'Disputed';
  }

  private resetSettlementForm(): void {
    this.settlementForm = { collectedAmount: 0, collectedMethod: DEFAULT_PAYMENT_METHOD, remarks: '' };
    this.disputeRemarksDraft = '';
  }

  loadSettlements(saleId: number): void {
    this.settlementLoading = true;
    this.settlementError   = '';

    this.deliverySettlementService.getBySale(saleId).subscribe({
      next: (res) => {
        this.settlements       = res.success ? res.data : [];
        this.settlementLoading = false;
        this.cdr.detectChanges();
      },
      error: (err) => {
        this.settlementError   = err?.error?.message || this.t('deliveryManReport.errors.settlement');
        this.settlementLoading = false;
        this.cdr.detectChanges();
      }
    });
  }

  submitSettlement(): void {
    if (!this.invoiceDetail) return;
    this.settlementActionBusy = true;
    this.settlementError = '';

    this.deliverySettlementService.create({
      saleId: this.invoiceDetail.saleId,
      collectedAmount: this.settlementForm.collectedAmount,
      collectedMethod: this.settlementForm.collectedMethod,
      remarks: this.settlementForm.remarks || undefined
    }).subscribe({
      next: () => {
        this.settlementActionBusy = false;
        this.resetSettlementForm();
        this.loadSettlements(this.invoiceDetail!.saleId);
        this.loadReport();
      },
      error: (err) => {
        this.settlementError = err?.error?.message || this.t('deliveryManReport.errors.settlement');
        this.settlementActionBusy = false;
        this.cdr.detectChanges();
      }
    });
  }

  verifySettlement(row: DeliverySettlementDto): void {
    if (!this.invoiceDetail) return;
    this.settlementActionBusy = true;
    this.settlementError = '';

    this.deliverySettlementService.verify(row.deliverySettlementId).subscribe({
      next: () => {
        this.settlementActionBusy = false;
        this.loadSettlements(this.invoiceDetail!.saleId);
        this.loadReport();
      },
      error: (err) => {
        this.settlementError = err?.error?.message || this.t('deliveryManReport.errors.settlement');
        this.settlementActionBusy = false;
        this.cdr.detectChanges();
      }
    });
  }

  disputeSettlement(row: DeliverySettlementDto): void {
    if (!this.invoiceDetail) return;
    if (!this.disputeRemarksDraft.trim()) {
      this.settlementError = this.t('deliveryManReport.errors.disputeReasonRequired');
      return;
    }
    this.settlementActionBusy = true;
    this.settlementError = '';

    this.deliverySettlementService.dispute(row.deliverySettlementId, this.disputeRemarksDraft.trim()).subscribe({
      next: () => {
        this.settlementActionBusy = false;
        this.disputeRemarksDraft = '';
        this.loadSettlements(this.invoiceDetail!.saleId);
        this.loadReport();
      },
      error: (err) => {
        this.settlementError = err?.error?.message || this.t('deliveryManReport.errors.settlement');
        this.settlementActionBusy = false;
        this.cdr.detectChanges();
      }
    });
  }

  //Plain window.open (no blob fetch) so it's a real top-level navigation that can't be popup-blocked; token rides as ?access_token= since navigation can't carry an Authorization header
  printInvoiceDetail(): void {
    if (!this.invoiceDetail) return;
    const url = this.saleService.getInvoicePdfUrl(this.invoiceDetail.saleId, this.authService.getToken());
    window.open(url, '_blank');
  }

  get invoiceDetailTotalQty(): number {
    return (this.invoiceDetail?.items || []).reduce((sum, i) => sum + (i.quantity || 0), 0);
  }

  get detailTotalPaid(): number {
    return this.detailStatement.reduce((sum, r) => sum + (r.paidAmount || 0), 0);
  }

  get detailTotalDue(): number {
    return this.detailStatement.reduce((sum, r) => sum + (r.dueAmount || 0), 0);
  }
}
