import { Component, OnInit, ChangeDetectorRef } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import {
  ReportsService,
  DailyProfitDto,
  ProductProfitDto,
  TopSellingProductDto
} from '../../services/reports.service';

@Component({
  selector: 'app-profit-report',
  standalone: true,
  imports: [CommonModule, FormsModule],
  templateUrl: './profit-report.component.html',
  styleUrls: ['./profit-report.component.css']
})
export class ProfitReportComponent implements OnInit {

  // ── Date range filter — defaults to today ─────────────────────────────
  fromDate = new Date().toISOString().split('T')[0];
  toDate   = new Date().toISOString().split('T')[0];

  // ── Report data ───────────────────────────────────────────────────────
  totalSales   = 0;
  totalCost    = 0;
  totalProfit  = 0;
  bestSeller: TopSellingProductDto | null = null;

  dailySummary: DailyProfitDto[]       = [];
  productDaily: ProductProfitDto[]     = [];
  topProducts:  TopSellingProductDto[] = [];

  isLoading  = false;
  errorMsg   = '';

  // ── Quick-filter pill state ───────────────────────────────────────────
  activeQuick: string = 'today';

  // Product-daily table is filterable by a specific day once you've
  // picked one from the daily summary above ("drill in" on a date).
  selectedDay: string | null = null;

  get overallMarginPct(): number {
    return this.totalSales > 0 ? (this.totalProfit * 100) / this.totalSales : 0;
  }

  get filteredProductDaily(): ProductProfitDto[] {
    if (!this.selectedDay) return this.productDaily;
    return this.productDaily.filter(p => p.saleDate === this.selectedDay);
  }

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
    this.reportsService.getProfitByDate(this.fromDate, this.toDate).subscribe({
      next: (res) => {
        if (res.success) {
          this.totalSales   = res.totalSales;
          this.totalCost    = res.totalCost;
          this.totalProfit  = res.totalProfit;
          this.bestSeller   = res.bestSeller;
          this.dailySummary = res.dailySummary;
          this.productDaily = res.productDaily;
          this.topProducts  = res.topProducts;
        }
        this.isLoading = false;
        this.cdr.detectChanges();
      },
      error: (err) => {
        this.errorMsg  = err?.error?.message || 'Failed to load profit report';
        this.isLoading = false;
        this.cdr.detectChanges();
      }
    });
  }

  applyFilter(): void {
    this.activeQuick  = '';   // manual date edit clears active pill
    this.selectedDay  = null;
    this.loadReport();
  }

  resetFilter(): void {
    this.applyQuick('today');
  }

  /** Called by the quick-filter pill buttons. */
  applyQuick(period: string): void {
    const today    = new Date();
    const todayStr = today.toISOString().split('T')[0];

    switch (period) {
      case 'today':
        this.fromDate = todayStr;
        this.toDate   = todayStr;
        break;
      case 'month': {
        const d = new Date(today.getFullYear(), today.getMonth(), 1);
        this.fromDate = d.toISOString().split('T')[0];
        this.toDate   = todayStr;
        break;
      }
      case 'quarter': {
        const d = new Date(today.getFullYear(), Math.floor(today.getMonth() / 3) * 3, 1);
        this.fromDate = d.toISOString().split('T')[0];
        this.toDate   = todayStr;
        break;
      }
      case 'year': {
        const d = new Date(today.getFullYear(), 0, 1);
        this.fromDate = d.toISOString().split('T')[0];
        this.toDate   = todayStr;
        break;
      }
      default: return;
    }

    this.activeQuick  = period;
    this.selectedDay  = null;
    this.loadReport();
  }

  selectDay(day: string): void {
    this.selectedDay = this.selectedDay === day ? null : day;
  }

  clearDaySelection(): void {
    this.selectedDay = null;
  }

  demandBadgeClass(level: string): string {
    switch (level) {
      case 'High':   return 'bg-green-100 text-green-700';
      case 'Medium': return 'bg-amber-100 text-amber-700';
      default:       return 'bg-gray-100 text-gray-600';
    }
  }
}
