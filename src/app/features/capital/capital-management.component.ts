import { Component, OnInit, ChangeDetectorRef } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { RouterLink } from '@angular/router';
import { TranslocoModule, provideTranslocoScope } from '@jsverse/transloco';
import { CapitalService, DailyCashRegisterRow, CapitalCategoryTotal, CapitalTxnType } from '../../services/capital.service';
import { paymentMethodLabelKey } from '../../shared/payment-methods';
import { toLocalDateString } from '../../shared/date-utils';

// ── Capital (ledger) page ────────────────────────────────────────────────
// This page used to also contain the "New Capital Transaction" entry form.
// That form has been split out into its own page — see
// features/capital-transaction/capital-transaction.component.ts, linked
// below via the "New Transaction" button — so this page is now purely the
// read side: the transaction grid, filters, and the Cash Flow period
// report (category breakdown + daily cash register). No API/DB behaviour
// changed here, only what UI lives on which route.
@Component({
  selector: 'app-capital-management',
  standalone: true,
  imports: [CommonModule, FormsModule, RouterLink, TranslocoModule],
  // Loads assets/i18n/capital/{en,bn}.json only when this route is hit.
  // Shared with the Capital Transaction page (form/warnings/validation keys
  // live in the same file, unused here).
  providers: [provideTranslocoScope('capital')],
  templateUrl: './capital-management.component.html',
  styleUrls: ['./capital-management.component.css']
})
export class CapitalManagementComponent implements OnInit {

  // ── TXN Types — used here only for the grid's type filter dropdown.
  // Loaded from TXN_TYPE_MASTER via GET /api/capital/txn-types (see
  // sp_GetCapitalTxnTypes) instead of being hardcoded here. ─────────────
  txnTypes: CapitalTxnType[] = [];

  paymentMethodLabelKey(value: string): string {
    return paymentMethodLabelKey(value);
  }

  // ── Transaction list ──────────────────────────────────────────────────
  // Pagination is client-side: one API call fetches every row matching the
  // current filters (search/date/type/D-C), then paging just re-slices the
  // already-loaded array in the browser — no extra HTTP request per page
  // click, and no dependence on the server getting OFFSET/FETCH exactly
  // right for what's currently on screen.
  private readonly fetchAllPageSize = 100000;

  allTxnList:    any[]  = [];   // full filtered dataset from the server
  txnTotal              = 0;
  txnPage               = 1;
  txnPageSize           = 20;   // rows per page, client-side only
  txnSearch             = '';
  txnTypeFilter         = 0;
  txnDrCrFilter         = '';
  // Default to the current month, same as the Period Report below, instead
  // of unbounded history — avoids surprising users with an apparently
  // "empty" grid while a full history fetch is still loading, and keeps
  // the two sections of the page showing the same window by default.
  txnFromDate           = toLocalDateString(new Date(new Date().getFullYear(), new Date().getMonth(), 1));
  txnToDate             = toLocalDateString();
  txnTotalDebit         = 0;
  txnTotalCredit        = 0;
  isLoading             = false;
  loadError             = false;
  Math                  = Math;

  /** The slice of allTxnList to render for the current page — recomputed locally, no network call. */
  get txnList(): any[] {
    const start = (this.txnPage - 1) * this.txnPageSize;
    return this.allTxnList.slice(start, start + this.txnPageSize);
  }

  get txnTotalPages(): number { return Math.ceil(this.txnTotal / this.txnPageSize) || 1; }
  get netCapital():    number { return this.txnTotalCredit - this.txnTotalDebit; }

  constructor(
    private capitalService: CapitalService,
    private cdr:            ChangeDetectorRef
  ) {}

  ngOnInit(): void {
    this.loadTxnTypes();
    this.loadTransactions();
    this.loadPeriodReports();
  }

  loadTxnTypes(): void {
    this.capitalService.getTxnTypes().subscribe({
      next: (res) => {
        if (res.success) this.txnTypes = res.data || [];
        this.cdr.detectChanges();
      },
      error: () => {}
    });
  }

  // ── Period Report: Category Breakdown + Daily Cash Register ─────────
  // One shared date range drives both — "how much per category" and
  // "cash reconciled day by day" are two views of the same period.
  dcrFromDate = toLocalDateString(new Date(new Date().getFullYear(), new Date().getMonth(), 1));
  dcrToDate   = toLocalDateString();

  categoryTotals: CapitalCategoryTotal[] = [];
  isCategoryLoading = false;

  dcrList: DailyCashRegisterRow[] = [];
  dcrOpeningBalance = 0;
  dcrClosingBalance = 0;
  isDcrLoading = false;

  get periodTotalCredit(): number {
    return this.categoryTotals.reduce((sum, c) => sum + c.totalCredit, 0);
  }
  get periodTotalDebit(): number {
    return this.categoryTotals.reduce((sum, c) => sum + c.totalDebit, 0);
  }

  loadPeriodReports(): void {
    this.loadCategoryTotals();
    this.loadDailyCashRegister();
  }

  loadCategoryTotals(): void {
    this.isCategoryLoading = true;
    this.capitalService.getCategoryTotals(this.dcrFromDate, this.dcrToDate).subscribe({
      next: (res) => {
        if (res.success) this.categoryTotals = res.data;
        this.isCategoryLoading = false;
        this.cdr.detectChanges();
      },
      error: () => { this.isCategoryLoading = false; }
    });
  }

  loadDailyCashRegister(): void {
    this.isDcrLoading = true;
    this.capitalService.getDailyCashRegister(this.dcrFromDate, this.dcrToDate).subscribe({
      next: (res) => {
        if (res.success) {
          this.dcrList = res.data;
          this.dcrOpeningBalance = res.openingBalance;
          this.dcrClosingBalance = res.closingBalance;
        }
        this.isDcrLoading = false;
        this.cdr.detectChanges();
      },
      error: () => { this.isDcrLoading = false; }
    });
  }

  applyDcrFilter(): void {
    this.loadPeriodReports();
  }

  resetDcrFilter(): void {
    this.dcrFromDate = toLocalDateString(new Date(new Date().getFullYear(), new Date().getMonth(), 1));
    this.dcrToDate   = toLocalDateString();
    this.loadPeriodReports();
  }

  /** Whether a category card should read as money-in (green) or money-out (orange) */
  isCategoryInflow(c: CapitalCategoryTotal): boolean {
    return c.totalCredit >= c.totalDebit;
  }

  // ── Grid ──────────────────────────────────────────────────────────────
  // Fetches every row matching the current filters in one call (server-side
  // filtering, client-side paging). Only filter changes re-hit the API;
  // changing page or page size just re-slices allTxnList (see txnList getter).
  loadTransactions(): void {
    this.isLoading = true;
    this.loadError  = false;
    this.capitalService.getTransactions(
      this.txnSearch, this.txnDrCrFilter, this.txnTypeFilter,
      this.txnFromDate, this.txnToDate, 1, this.fetchAllPageSize
    ).subscribe({
      next: (res) => {
        if (res.success) {
          this.allTxnList      = res.data || [];
          this.txnTotal        = res.totalCount ?? this.allTxnList.length;
          this.txnTotalDebit   = res.totalDebit  ?? 0;
          this.txnTotalCredit  = res.totalCredit ?? 0;
        } else {
          this.loadError = true;
        }
        this.isLoading = false;
        this.cdr.detectChanges();
      },
      error: () => {
        this.isLoading = false;
        this.loadError = true;
        this.cdr.detectChanges();
      }
    });
  }

  applyFilters(): void { this.txnPage = 1; this.loadTransactions(); }

  resetFilters(): void {
    this.txnSearch     = '';
    this.txnDrCrFilter = '';
    this.txnTypeFilter = 0;
    this.txnFromDate   = toLocalDateString(new Date(new Date().getFullYear(), new Date().getMonth(), 1));
    this.txnToDate     = toLocalDateString();
    this.txnPage       = 1;
    this.loadTransactions();
  }

  /** Page nav — no HTTP call, just re-slices the already-loaded dataset. */
  goToPage(page: number): void {
    if (page < 1 || page > this.txnTotalPages) return;
    this.txnPage = page;
  }

  onPageSizeChange(): void {
    this.txnPage = 1;
  }

  getTxnTypeName(id: number): string {
    return this.txnTypes.find(t => t.txnTypeId === id)?.txnName || '-';
  }

  getTxnTypeCode(id: number): string {
    return this.txnTypes.find(t => t.txnTypeId === id)?.txnCode || '-';
  }
}
