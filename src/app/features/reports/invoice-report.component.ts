import { Component, OnInit, ChangeDetectorRef } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { ReportsService, InvoiceReportDto } from '../../services/reports.service';
import { CustomerService, Customer } from '../../services/customer.service';
import { toLocalDateString } from '../../shared/date-utils';

@Component({
  selector: 'app-invoice-report',
  standalone: true,
  imports: [CommonModule, FormsModule],
  templateUrl: './invoice-report.component.html',
  styleUrls: ['./invoice-report.component.css']
})
export class InvoiceReportComponent implements OnInit {

  fromDate = toLocalDateString();
  toDate   = toLocalDateString();
  activeQuick: string = 'today';
  customerFilter: number | '' = '';

  customers: Customer[] = [];
  rows: InvoiceReportDto[] = [];

  isLoading = false;
  errorMsg  = '';

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

    this.reportsService.getInvoiceReport(this.fromDate, this.toDate, customerId).subscribe({
      next: (res) => {
        this.rows = res.success ? res.data : [];
        this.isLoading = false;
        this.cdr.detectChanges();
      },
      error: (err) => {
        this.rows      = [];
        this.errorMsg  = err?.error?.message || 'Failed to load invoice report';
        this.isLoading = false;
        this.cdr.detectChanges();
      }
    });
  }

  get totalNetAmount(): number {
    return this.rows.reduce((sum, r) => sum + (r.netAmount || 0), 0);
  }

  get totalPaid(): number {
    return this.rows.reduce((sum, r) => sum + (r.paidAmount || 0), 0);
  }

  get totalDue(): number {
    return this.rows.reduce((sum, r) => sum + (r.dueAmount || 0), 0);
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
}
