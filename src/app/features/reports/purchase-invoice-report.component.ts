import { Component, OnInit, ChangeDetectorRef } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { TranslocoModule, TranslocoService, provideTranslocoScope } from '@jsverse/transloco';
import { ReportsService, SupplierPurchaseDetailDto } from '../../services/reports.service';
import { SupplierService } from '../../services/supplier.service';
import { toLocalDateString } from '../../shared/date-utils';
import { downloadBlob } from '../../shared/pdf-export.util';

interface SupplierOption {
  supplierId: number;
  supplierName: string;
}

@Component({
  selector: 'app-purchase-invoice-report',
  standalone: true,
  imports: [CommonModule, FormsModule, TranslocoModule],
  //Provided here too so it works whether used standalone or nested (same pattern as Dashboard/Products/POS-Billing)
  providers: [provideTranslocoScope('reports')],
  templateUrl: './purchase-invoice-report.component.html',
  styleUrls: ['./purchase-invoice-report.component.css']
})
export class PurchaseInvoiceReportComponent implements OnInit {

  fromDate = toLocalDateString();
  toDate   = toLocalDateString();
  activeQuick: string = 'today';
  supplierFilter: number | '' = '';

  //Client-side search — filters rows already loaded for the current date range/supplier, no reload
  searchText = '';

  suppliers: SupplierOption[] = [];
  rows: SupplierPurchaseDetailDto[] = [];

  isLoading   = false;
  isExporting = false;
  errorMsg    = '';

  constructor(
    private reportsService: ReportsService,
    private supplierService: SupplierService,
    private cdr: ChangeDetectorRef,
    private transloco: TranslocoService
  ) {}

  //Shorthand for the 'reports' scope, provided by ReportsHubComponent
  private t(key: string, params?: Record<string, unknown>): string {
    return this.transloco.translate(`reports.${key}`, params);
  }

  ngOnInit(): void {
    this.loadSuppliers();
    this.loadReport();
  }

  loadSuppliers(): void {
    this.supplierService.getAllSuppliers().subscribe({
      next: (res: any) => {
        this.suppliers = Array.isArray(res) ? res : (res?.data ?? []);
      },
      error: () => { /* supplier dropdown just stays empty on failure */ }
    });
  }

  loadReport(): void {
    this.isLoading = true;
    this.errorMsg  = '';
    const supplierId = this.supplierFilter === '' ? null : Number(this.supplierFilter);

    this.reportsService.getPurchaseInvoiceReport(this.fromDate, this.toDate, supplierId).subscribe({
      next: (res) => {
        this.rows = res.success ? res.data : [];
        this.isLoading = false;
        this.cdr.detectChanges();
      },
      error: (err) => {
        this.rows      = [];
        this.errorMsg  = err?.error?.message || this.t('purchaseInvoiceReport.errors.load');
        this.isLoading = false;
        this.cdr.detectChanges();
      }
    });
  }

  get filteredRows(): SupplierPurchaseDetailDto[] {
    const q = this.searchText.trim().toLowerCase();
    if (!q) return this.rows;
    return this.rows.filter(r =>
      (r.supplierName || '').toLowerCase().includes(q) ||
      String(r.purchaseId).includes(q)
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
    this.supplierFilter = '';
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

  exportPdf(): void {
    const supplierId = this.supplierFilter === '' ? null : Number(this.supplierFilter);
    this.isExporting = true;
    this.reportsService.getPurchaseInvoiceReportPdf(this.fromDate, this.toDate, supplierId).subscribe({
      next: (blob) => {
        downloadBlob(blob, `Purchase-Invoice-Report_${this.fromDate}_to_${this.toDate}.pdf`);
        this.isExporting = false;
        this.cdr.detectChanges();
      },
      error: (err) => {
        this.errorMsg  = err?.error?.message || this.t('purchaseInvoiceReport.errors.pdf');
        this.isExporting = false;
        this.cdr.detectChanges();
      }
    });
  }
}
