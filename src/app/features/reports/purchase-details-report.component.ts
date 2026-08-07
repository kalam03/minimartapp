import { Component, OnInit, ChangeDetectorRef } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { TranslocoModule, TranslocoService, provideTranslocoScope } from '@jsverse/transloco';
import { ReportsService, PurchaseDetailLineDto } from '../../services/reports.service';
import { SupplierService } from '../../services/supplier.service';
import { toLocalDateString } from '../../shared/date-utils';
import { downloadBlob } from '../../shared/pdf-export.util';

interface SupplierOption {
  supplierId: number;
  supplierName: string;
}

@Component({
  selector: 'app-purchase-details-report',
  standalone: true,
  imports: [CommonModule, FormsModule, TranslocoModule],
  //Provided here too so it works whether used standalone or nested (same pattern as Dashboard/Products/POS-Billing)
  providers: [provideTranslocoScope('reports')],
  templateUrl: './purchase-details-report.component.html',
  styleUrls: ['./purchase-details-report.component.css']
})
export class PurchaseDetailsReportComponent implements OnInit {

  fromDate = toLocalDateString();
  toDate   = toLocalDateString();
  activeQuick: string = 'today';
  supplierFilter: number | '' = '';

  //Product search is client-side — filters rows already loaded for the current date range/supplier instead of round-tripping to the API
  productSearch = '';

  suppliers: SupplierOption[] = [];
  rows: PurchaseDetailLineDto[] = [];

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

    this.reportsService.getPurchaseLineDetails(this.fromDate, this.toDate, supplierId).subscribe({
      next: (res) => {
        this.rows = res.success ? res.data : [];
        this.isLoading = false;
        this.cdr.detectChanges();
      },
      error: (err) => {
        this.rows      = [];
        this.errorMsg  = err?.error?.message || this.t('purchaseDetailsReport.errors.load');
        this.isLoading = false;
        this.cdr.detectChanges();
      }
    });
  }

  get filteredRows(): PurchaseDetailLineDto[] {
    const q = this.productSearch.trim().toLowerCase();
    if (!q) return this.rows;
    return this.rows.filter(r => (r.productName || '').toLowerCase().includes(q));
  }

  get totalQty(): number {
    return this.filteredRows.reduce((sum, r) => sum + (r.quantity || 0), 0);
  }

  get totalAmount(): number {
    return this.filteredRows.reduce((sum, r) => sum + (r.total || 0), 0);
  }

  applyFilter(): void {
    this.activeQuick = '';
    this.loadReport();
  }

  resetFilter(): void {
    this.supplierFilter = '';
    this.productSearch  = '';
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
    this.reportsService.getPurchaseLineDetailsPdf(this.fromDate, this.toDate, supplierId).subscribe({
      next: (blob) => {
        downloadBlob(blob, `Purchase-Details_${this.fromDate}_to_${this.toDate}.pdf`);
        this.isExporting = false;
        this.cdr.detectChanges();
      },
      error: (err) => {
        this.errorMsg  = err?.error?.message || this.t('purchaseDetailsReport.errors.pdf');
        this.isExporting = false;
        this.cdr.detectChanges();
      }
    });
  }
}
