import { Component, OnInit, ChangeDetectorRef } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { ReportsService, SalesSummaryDto } from '../../services/reports.service';
import { toLocalDateString } from '../../shared/date-utils';

@Component({
  selector: 'app-sales-summary-report',
  standalone: true,
  imports: [CommonModule, FormsModule],
  templateUrl: './sales-summary-report.component.html',
  styleUrls: ['./sales-summary-report.component.css']
})
export class SalesSummaryReportComponent implements OnInit {

  fromDate = toLocalDateString();
  toDate   = toLocalDateString();
  activeQuick: string = 'today';

  summary: SalesSummaryDto = {
    totalInvoices: 0,
    totalSales: 0,
    totalDiscount: 0,
    totalTransport: 0,
    totalNetAmount: 0,
    totalPaid: 0,
    totalDue: 0
  };

  isLoading = false;
  errorMsg  = '';

  constructor(
    private reportsService: ReportsService,
    private cdr: ChangeDetectorRef
  ) {}

  ngOnInit(): void {
    this.loadReport();
  }

  loadReport(): void {
    this.isLoading = true;
    this.errorMsg  = '';
    this.reportsService.getSalesSummary(this.fromDate, this.toDate).subscribe({
      next: (res) => {
        if (res.success) {
          this.summary = res.data;
        }
        this.isLoading = false;
        this.cdr.detectChanges();
      },
      error: (err) => {
        this.errorMsg  = err?.error?.message || 'Failed to load sales summary';
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
}
