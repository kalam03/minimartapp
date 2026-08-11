import { Component, OnInit, ChangeDetectorRef } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { TranslocoModule, TranslocoService, provideTranslocoScope } from '@jsverse/transloco';
import { ReportsService, InvoiceReportDto } from '../../services/reports.service';
import { CustomerService, Customer } from '../../services/customer.service';
import { SaleService, SaleInvoiceDto } from '../../services/sale.service';
import { AuthService } from '../../services/auth.service';
import { toLocalDateString } from '../../shared/date-utils';
import { downloadBlob } from '../../shared/pdf-export.util';
import { AlertService } from '../../shared/alert.service';
import {
  buildThermalReceiptHtml,
  printReceiptSilently,
  readStoredPrinterModel,
} from '../../shared/thermal-receipt.util';

@Component({
  selector: 'app-invoice-report',
  standalone: true,
  imports: [CommonModule, FormsModule, TranslocoModule],
  //Provided here too so it works whether used standalone or nested (same pattern as Dashboard/Products/POS-Billing)
  providers: [provideTranslocoScope('reports')],
  templateUrl: './invoice-report.component.html',
  styleUrls: ['./invoice-report.component.css']
})
export class InvoiceReportComponent implements OnInit {

  fromDate = toLocalDateString();
  toDate   = toLocalDateString();
  activeQuick: string = 'today';
  customerFilter: number | '' = '';

  //Client-side search — filters rows already loaded for the current date range/customer, no reload
  searchText = '';

  customers: Customer[] = [];
  rows: InvoiceReportDto[] = [];

  isLoading   = false;
  isExporting = false;
  errorMsg    = '';

  //Per-row thermal-receipt reprint (see printReceipt below) — tracks which row is currently fetching its invoice detail, so its button can show a busy state without blocking the rest of the grid
  receiptPrintingSaleId: number | null = null;

  constructor(
    private reportsService: ReportsService,
    private customerService: CustomerService,
    private saleService: SaleService,
    private authService: AuthService,
    private alertService: AlertService,
    private cdr: ChangeDetectorRef,
    private transloco: TranslocoService
  ) {}

  //Shorthand for the 'reports' scope, provided by ReportsHubComponent
  private t(key: string, params?: Record<string, unknown>): string {
    return this.transloco.translate(`reports.${key}`, params);
  }

  ngOnInit(): void {
    this.loadCustomers();
    this.loadReport();
  }

  loadCustomers(): void {
    this.customerService.getAllCustomers({ isActive: true }).subscribe({
      next: (res: any) => {
        this.customers = Array.isArray(res) ? res : res.data || [];
      },
      error: () => { /* customer dropdown just stays empty on failure */ }
    });
  }

  loadReport(): void {
    this.isLoading = true;
    this.errorMsg  = '';
    const customerId = this.customerFilter === '' ? null : Number(this.customerFilter);

    this.reportsService.getInvoiceReport(this.fromDate, this.toDate, customerId).subscribe({
      next: (res) => {
        this.rows = res.success ? res.data : [];
        this.isLoading = false;
        this.cdr.detectChanges();
      },
      error: (err) => {
        this.rows      = [];
        this.errorMsg  = err?.error?.message || this.t('invoiceReport.errors.load');
        this.isLoading = false;
        this.cdr.detectChanges();
      }
    });
  }

  get filteredRows(): InvoiceReportDto[] {
    const q = this.searchText.trim().toLowerCase();
    if (!q) return this.rows;
    return this.rows.filter(r =>
      (r.invoiceNo       || '').toLowerCase().includes(q) ||
      (r.customerName    || '').toLowerCase().includes(q) ||
      (r.deliveryManName || '').toLowerCase().includes(q) ||
      (r.deliveryManCode || '').toLowerCase().includes(q)
    );
  }

  get totalNetAmount(): number {
    return this.filteredRows.reduce((sum, r) => sum + (r.netAmount || 0), 0);
  }

  get totalPaid(): number {
    return this.filteredRows.reduce((sum, r) => sum + (r.paidAmount || 0), 0);
  }

  get totalDue(): number {
    return this.filteredRows.reduce((sum, r) => sum + (r.dueAmount || 0), 0);
  }

  applyFilter(): void {
    this.activeQuick = '';
    this.loadReport();
  }

  resetFilter(): void {
    this.customerFilter = '';
    this.searchText     = '';
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

  //Plain window.open called synchronously (no blob fetch) so it's a real top-level navigation that can't be popup-blocked; token rides as ?access_token= since navigation can't carry an Authorization header
  printInvoice(row: InvoiceReportDto): void {
    const url = this.saleService.getInvoicePdfUrl(row.saleId, this.authService.getToken());
    window.open(url, '_blank');
  }

  //Reprints a past invoice as the same thermal receipt format used on the counter/POS page (see shared/thermal-receipt.util.ts) instead of the A4 PDF above — fetches the full item-level invoice, maps it into the same loose "receipt" shape pos-billing.ts builds from a live cart, then renders/prints it silently via a hidden iframe. Uses whatever printer (58mm/80mm) is currently saved from the counter page, so reprints match the shop's actual printer without needing a selector here too.
  printReceipt(row: InvoiceReportDto): void {
    this.receiptPrintingSaleId = row.saleId;
    this.saleService.getInvoiceDetail(row.saleId).subscribe({
      next: (res) => {
        this.receiptPrintingSaleId = null;
        if (!res.success || !res.data) {
          this.alertService.warning(this.t('invoiceReport.errors.receiptDetail'));
          this.cdr.detectChanges();
          return;
        }
        const receipt = this.mapInvoiceToReceipt(res.data);
        const printerModel = readStoredPrinterModel();
        const receiptHtml = buildThermalReceiptHtml(receipt, printerModel);
        printReceiptSilently(receiptHtml);
        this.cdr.detectChanges();
      },
      error: (err) => {
        this.receiptPrintingSaleId = null;
        this.alertService.warning(err?.error?.message || this.t('invoiceReport.errors.receiptDetail'));
        this.cdr.detectChanges();
      }
    });
  }

  //Field-shape adapter: SaleInvoiceDto (flat, backend-shaped) -> the loose "receipt" object buildThermalReceiptHtml expects (mirrors what pos-billing.ts's submitBill() builds from live cart state — see thermal-receipt.util.ts header comment for the full shape).
  private mapInvoiceToReceipt(dto: SaleInvoiceDto): any {
    return {
      invoiceNo: dto.invoiceNo,
      saleDate: dto.saleDate,
      customerId: dto.customerId,
      customerName: dto.customerName,
      customerPhone: dto.customerPhone,
      totalAmount: dto.totalAmount,
      discount: dto.discount,
      // SaleInvoiceDto doesn't store the original discount %, only the resulting amount — recompute for the "Discount (X%)" receipt line.
      discountPercent: dto.totalAmount > 0 ? +((dto.discount / dto.totalAmount) * 100).toFixed(1) : 0,
      promoDiscount: dto.promotionDiscountAmount,
      appliedPromotions: dto.appliedPromotions || [],
      transportCost: dto.transportCost,
      transport: dto.transport,
      transportDetail: dto.deliveryManName || dto.deliveryManCode || '',
      previousDue: dto.previousBalance,
      roundOffAmount: dto.roundOffAmount,
      netAmount: dto.netAmount,
      paymentType: dto.paymentType,
      paidAmount: dto.paidAmount,
      returnAmount: dto.returnAmount,
      dueAmount: dto.dueAmount,
      generatedBy: dto.createdBy || '',
      items: (dto.items || []).map((i) => ({
        product: { productId: i.productId, productName: i.productName },
        unitPrice: i.unitPrice,
        quantity: i.quantity,
        subtotal: i.total,
      })),
    };
  }

  exportPdf(): void {
    const customerId = this.customerFilter === '' ? null : Number(this.customerFilter);
    this.isExporting = true;
    this.reportsService.getInvoiceReportPdf(this.fromDate, this.toDate, customerId).subscribe({
      next: (blob) => {
        downloadBlob(blob, `Invoice-Report_${this.fromDate}_to_${this.toDate}.pdf`);
        this.isExporting = false;
        this.cdr.detectChanges();
      },
      error: (err) => {
        this.errorMsg  = err?.error?.message || this.t('invoiceReport.errors.pdf');
        this.isExporting = false;
        this.cdr.detectChanges();
      }
    });
  }
}
