import { Component, OnInit, ChangeDetectorRef } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { TranslocoModule, TranslocoService, provideTranslocoScope } from '@jsverse/transloco';
import { ReportsService, InvoiceReportDto } from '../../services/reports.service';
import { CustomerService, Customer } from '../../services/customer.service';
import { SaleService } from '../../services/sale.service';
import { AuthService } from '../../services/auth.service';
import { toLocalDateString } from '../../shared/date-utils';
import { downloadBlob } from '../../shared/pdf-export.util';

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

  constructor(
    private reportsService: ReportsService,
    private customerService: CustomerService,
    private saleService: SaleService,
    private authService: AuthService,
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
