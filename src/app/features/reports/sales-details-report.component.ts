import { Component, OnInit, ChangeDetectorRef } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { ReportsService, SalesDetailDto } from '../../services/reports.service';
import { CustomerService, Customer } from '../../services/customer.service';
import { toLocalDateString } from '../../shared/date-utils';
import { downloadBlob } from '../../shared/pdf-export.util';

@Component({
  selector: 'app-sales-details-report',
  standalone: true,
  imports: [CommonModule, FormsModule],
  templateUrl: './sales-details-report.component.html',
  styleUrls: ['./sales-details-report.component.css']
})
export class SalesDetailsReportComponent implements OnInit {

  fromDate = toLocalDateString();
  toDate   = toLocalDateString();
  activeQuick: string = 'today';
  customerFilter: number | '' = '';

  customers: Customer[] = [];
  rows: SalesDetailDto[] = [];

  isLoading   = false;
  isExporting = false;
  errorMsg    = '';

  constructor(
    private reportsService: ReportsService,
    private customerService: CustomerService,
    private cdr: ChangeDetectorRef
  ) {}

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

    this.reportsService.getSalesDetails(this.fromDate, this.toDate, customerId).subscribe({
      next: (res) => {
        this.rows = res.success ? res.data : [];
        this.isLoading = false;
        this.cdr.detectChanges();
      },
      error: (err) => {
        this.rows      = [];
        this.errorMsg  = err?.error?.message || 'Failed to load sales details';
        this.isLoading = false;
        this.cdr.detectChanges();
      }
    });
  }

  get totalQty(): number {
    return this.rows.reduce((sum, r) => sum + (r.quantity || 0), 0);
  }

  get totalAmount(): number {
    return this.rows.reduce((sum, r) => sum + (r.total || 0), 0);
  }

  applyFilter(): void {
    this.activeQuick = '';
    this.loadReport();
  }

  resetFilter(): void {
    this.customerFilter = '';
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
    const customerId = this.customerFilter === '' ? null : Number(this.customerFilter);
    this.isExporting = true;
    this.reportsService.getSalesDetailsPdf(this.fromDate, this.toDate, customerId).subscribe({
      next: (blob) => {
        downloadBlob(blob, `Sales-Details_${this.fromDate}_to_${this.toDate}.pdf`);
        this.isExporting = false;
        this.cdr.detectChanges();
      },
      error: (err) => {
        this.errorMsg  = err?.error?.message || 'Failed to generate PDF';
        this.isExporting = false;
        this.cdr.detectChanges();
      }
    });
  }
}
