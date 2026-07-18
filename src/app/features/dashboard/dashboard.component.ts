import { Component, OnInit, ChangeDetectorRef } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { TranslocoModule, provideTranslocoScope } from '@jsverse/transloco';
import { CustomerService } from '../../services/customer.service';
import { PurchaseService, PurchaseSummaryDto } from '../../services/purchase.service';
import { SaleService, SalesSummaryDto, DailyPerformanceDto } from '../../services/sale.service';
import { ProductService } from '../../services/product.service';
import { SupplierService } from '../../services/supplier.service';
import { Product as ApiProduct } from '../../models/product';
import { toLocalDateString } from '../../shared/date-utils';

interface Transaction {
  id: number;
  date: string;
  amount: number;
  type: 'sale' | 'purchase';
  partyId: number;
  partyName: string;
  paymentStatus?: 'paid' | 'partial' | 'pending';
  paymentMethod?: 'cash' | 'card' | 'bank';
}

interface Party {
  id: number;
  name: string;
  type: 'customer' | 'supplier';
  dueAmount: number;
  totalPurchases?: number;
  totalSales?: number;
  phone?: string;
  email?: string;
  address?: string;
  lastTransaction?: string;
  creditLimit?: number;
}

interface DailyStats {
  date: string;
  sales: number;
  purchases: number;
  profit: number;
}

@Component({
  selector: 'app-dashboard',
  standalone: true,
  imports: [CommonModule, FormsModule, TranslocoModule],
  // Loads assets/i18n/dashboard/{en,bn}.json only when this route is hit —
  // see Multilingual_Localization_Architecture.md Section 5.1.
  providers: [provideTranslocoScope('dashboard')],
  templateUrl: './dashboard.component.html',
  styleUrls: ['./dashboard.component.css']
})
export class DashboardComponent implements OnInit {
  customers: any[] = [];

  // Purchase summary from API
  purchaseSummary: PurchaseSummaryDto = {
    totalInvoices: 0, totalPurchase: 0, totalDiscount: 0, totalTransport: 0,
    totalNetAmount: 0, totalPaid: 0, totalDue: 0, totalReturn: 0
  };
  purchaseSummaryLoading = false;

  // Customer Due
  customerDueList: any[] = []; customerDueTotal = 0;
  customerDuePage = 1; customerDuePageSize = 10; customerDueSearch = '';
  get customerDueTotalPages(): number { return Math.ceil(this.customerDueTotal / this.customerDuePageSize) || 1; }

  // Supplier Due
  supplierDueList: any[] = []; supplierDueTotal = 0;
  supplierDuePage = 1; supplierDuePageSize = 10; supplierDueSearch = '';
  get supplierDueTotalPages(): number { return Math.ceil(this.supplierDueTotal / this.supplierDuePageSize) || 1; }

  // Low Stock
  lowStockList: any[] = []; lowStockTotal = 0;
  lowStockPage = 1; lowStockPageSize = 10; lowStockSearch = ''; lowStockThreshold = 10;
  get lowStockTotalPages(): number { return Math.ceil(this.lowStockTotal / this.lowStockPageSize) || 1; }

  // Top Products search
  topProductsSearch = '';

  // Recent Transactions (live from GL_TRANSACTION)
  recentTxnList: any[] = []; recentTxnTotal = 0;
  recentTxnPage = 1; recentTxnPageSize = 20; recentTxnSearch = ''; recentTxnTypeFilter = '';
  recentTxnTotalDebit = 0; recentTxnTotalCredit = 0;
  get recentTxnTotalPages(): number { return Math.ceil(this.recentTxnTotal / this.recentTxnPageSize) || 1; }
  get recentRevenue(): number { return this.recentTxnTotalCredit - this.recentTxnTotalDebit; }

  // Daily performance from API
  apiDailyPerformance: DailyPerformanceDto[] = [];
  get apiMaxDailyValue(): number {
    if (!this.apiDailyPerformance.length) return 100;
    const max = Math.max(...this.apiDailyPerformance.map(d => Math.max(d.totalSales, d.totalPurchases)));
    return max > 0 ? max : 100;
  }

  // Sales summary from API
  salesSummary: SalesSummaryDto = {
    totalInvoices: 0, totalSales: 0, totalDiscount: 0, totalTransport: 0,
    totalNetAmount: 0, totalPaid: 0, totalDue: 0
  };
  salesSummaryLoading = false;

  constructor(
    private customerService: CustomerService,
    private purchaseService: PurchaseService,
    private saleService: SaleService,
    private productService: ProductService,
    private supplierService: SupplierService,
    private cdr: ChangeDetectorRef
  ) {}

  ngOnInit(): void {
    this.getAllCustomers();
    this.loadPurchaseSummary();
    this.loadSalesSummary();
    this.loadDailyPerformance();
    this.loadCustomerDue();
    this.loadSupplierDue();
    this.loadLowStock();
    this.loadRecentTransactions();
    this.loadInventoryProducts();
    this.loadSuppliersCount();
  }

  /** Real product list backing Inventory Value / Top Products by Inventory Value (was static mock data). */
  loadInventoryProducts(): void {
    this.productService.getAllProducts({ isActive: true }).subscribe({
      next: (response: any) => {
        this.apiProducts = Array.isArray(response) ? response : response.data || [];
        this.cdr.detectChanges();
      },
      error: (err: any) => {
        console.error('Error loading products for inventory:', err);
        this.apiProducts = [];
      }
    });
  }

  /** Real supplier count backing the "Total Suppliers" KPI card (was static mock data). */
  loadSuppliersCount(): void {
    this.supplierService.getAllSuppliers().subscribe({
      next: (response: any) => {
        const list = Array.isArray(response) ? response : response.data || [];
        this.totalSuppliers = list.length;
        this.cdr.detectChanges();
      },
      error: (err: any) => {
        console.error('Error loading suppliers:', err);
        this.totalSuppliers = 0;
      }
    });
  }

  getAllCustomers(): void {
    this.customerService.getAllCustomers().subscribe({
      next: (response: any) => {
        this.customers = Array.isArray(response) ? response : response.data || [];
        this.cdr.detectChanges();
      },
      error: (err: any) => {
        console.error('Error loading customers:', err);
        this.customers = [];
      }
    });
  }

  loadPurchaseSummary(): void {
    this.purchaseSummaryLoading = true;
    this.purchaseService.getPurchaseSummary(this.startDate, this.endDate).subscribe({
      next: (res) => {
        if (res.success) this.purchaseSummary = res.data;
        this.purchaseSummaryLoading = false;
        this.cdr.detectChanges();
      },
      error: (err) => {
        console.error('Error loading purchase summary:', err);
        this.purchaseSummaryLoading = false;
      }
    });
  }

  loadCustomerDue(): void {
    this.saleService.getCustomerDue(this.customerDueSearch, this.customerDuePage, this.customerDuePageSize).subscribe({
      next: (res) => { if (res.success) { this.customerDueList = res.data; this.customerDueTotal = res.totalCount; this.cdr.detectChanges(); } },
      error: (err) => console.error('Customer due error:', err)
    });
  }

  loadSupplierDue(): void {
    this.saleService.getSupplierDue(this.supplierDueSearch, this.supplierDuePage, this.supplierDuePageSize).subscribe({
      next: (res) => { if (res.success) { this.supplierDueList = res.data; this.supplierDueTotal = res.totalCount; this.cdr.detectChanges(); } },
      error: (err) => console.error('Supplier due error:', err)
    });
  }

  loadLowStock(): void {
    this.saleService.getLowStock(this.lowStockSearch, this.lowStockThreshold, this.lowStockPage, this.lowStockPageSize).subscribe({
      next: (res) => { if (res.success) { this.lowStockList = res.data; this.lowStockTotal = res.totalCount; this.cdr.detectChanges(); } },
      error: (err) => console.error('Low stock error:', err)
    });
  }

  loadRecentTransactions(): void {
    this.saleService.getRecentTransactions(this.recentTxnSearch, this.recentTxnTypeFilter, this.recentTxnPage, this.recentTxnPageSize).subscribe({
      next: (res) => {
        if (res.success) {
          this.recentTxnList        = res.data;
          this.recentTxnTotal       = res.totalCount;
          this.recentTxnTotalDebit  = res.totalDebit;
          this.recentTxnTotalCredit = res.totalCredit;
          this.cdr.detectChanges();
        }
      },
      error: (err) => console.error('Recent transactions error:', err)
    });
  }

  loadDailyPerformance(): void {
    this.saleService.getDailyPerformance(7).subscribe({
      next: (res) => {
        if (res.success) { this.apiDailyPerformance = res.data; this.cdr.detectChanges(); }
      },
      error: (err) => console.error('Error loading daily performance:', err)
    });
  }

  loadSalesSummary(): void {
    this.salesSummaryLoading = true;
    this.saleService.getSalesSummary(this.startDate, this.endDate).subscribe({
      next: (res) => {
        if (res.success) this.salesSummary = res.data;
        this.salesSummaryLoading = false;
        this.cdr.detectChanges();
      },
      error: (err) => {
        console.error('Error loading sales summary:', err);
        this.salesSummaryLoading = false;
      }
    });
  }
  // Enhanced Static Data
  private transactions: Transaction[] = [

  ];

  private parties: Party[] = [
    // Customers

  ];

  // Real product list from the API — backs totalProducts/inventoryValue/
  // lowStockProducts/topProductsByValue below (was a static mock array).
  apiProducts: ApiProduct[] = [];

  // Real supplier count from the API — backs the "Total Suppliers" KPI card
  // (was `this.parties.filter(p => p.type === 'supplier').length` over mock data).
  totalSuppliers = 0;

  // Date filter properties
  todayDate: string = toLocalDateString();
  startDate: string = this.todayDate;
  endDate: string = this.todayDate;
  activeQuick: string = 'today';

  // Computed Properties for enhanced metrics
  get todayStats() {
    const today = this.todayDate;
    const todaySales = this.transactions
      .filter(t => t.type === 'sale' && t.date === today)
      .reduce((sum, t) => sum + t.amount, 0);
    const todayPurchases = this.transactions
      .filter(t => t.type === 'purchase' && t.date === today)
      .reduce((sum, t) => sum + t.amount, 0);
    return {
      sales: todaySales,
      purchases: todayPurchases,
      profit: todaySales - todayPurchases
    };
  }

  get filteredTransactions() {
    let filtered = this.transactions;
    if (this.startDate) {
      filtered = filtered.filter(t => t.date >= this.startDate);
    }
    if (this.endDate) {
      filtered = filtered.filter(t => t.date <= this.endDate);
    }
    return filtered;
  }

  get filteredStats() {
    const sales = this.filteredTransactions
      .filter(t => t.type === 'sale')
      .reduce((sum, t) => sum + t.amount, 0);
    const purchases = this.filteredTransactions
      .filter(t => t.type === 'purchase')
      .reduce((sum, t) => sum + t.amount, 0);
    return { sales, purchases, profit: sales - purchases };
  }

  get previousPeriodStats() {
    // Simple comparison with previous period (same length)
    const currentLength = this.filteredTransactions.length;
    // For demo, returning calculated growth
    return { sales: this.filteredStats.sales * 0.85, purchases: this.filteredStats.purchases * 0.9 };
  }

  get salesGrowth(): number {
    const prev = this.previousPeriodStats.sales;
    const current = this.filteredStats.sales;
    if (prev === 0) return 0;
    return Math.round(((current - prev) / prev) * 100);
  }

  get purchasesGrowth(): number {
    const prev = this.previousPeriodStats.purchases;
    const current = this.filteredStats.purchases;
    if (prev === 0) return 0;
    return Math.round(((current - prev) / prev) * 100);
  }

  get profitMargin(): number {
    if (this.filteredStats.sales === 0) return 0;
    return Math.round((this.filteredStats.profit / this.filteredStats.sales) * 100);
  }

  get totalTransactions(): number {
    return this.filteredTransactions.length;
  }

  get salesCount(): number {
    return this.filteredTransactions.filter(t => t.type === 'sale').length;
  }

  get purchasesCount(): number {
    return this.filteredTransactions.filter(t => t.type === 'purchase').length;
  }

  get totalCustomers(): number {
    return this.customers.length;
  }

  get totalCustomerDue(): number {
    return this.customers.reduce((sum, customer) => sum + customer.dueAmount, 0);
  }

  get totalSupplierDebt(): number {
    return this.parties.filter(p => p.type === 'supplier').reduce((sum, p) => sum + p.dueAmount, 0);
  }

  get totalProducts(): number {
    return this.apiProducts.length;
  }

  get inventoryValue(): number {
    return this.apiProducts.reduce((sum, p) => sum + p.totalStockValue, 0);
  }

  get avgTransactionValue(): number {
    if (this.totalTransactions === 0) return 0;
    const totalValue = this.filteredTransactions.reduce((sum, t) => sum + t.amount, 0);
    return totalValue / this.totalTransactions;
  }

  get topCustomerDue(): Party[] {
    return this.parties
      .filter(p => p.type === 'customer' && p.dueAmount > 0)
      .sort((a, b) => b.dueAmount - a.dueAmount)
      .slice(0, 10);
  }

  get topSupplierDebt(): Party[] {
    return this.parties
      .filter(p => p.type === 'supplier' && p.dueAmount > 0)
      .sort((a, b) => b.dueAmount - a.dueAmount)
      .slice(0, 10);
  }

  get lowStockProducts(): ApiProduct[] {
    return this.apiProducts
      .filter(p => p.stockStatus === 'Low Stock' || p.stockStatus === 'Out of Stock')
      .sort((a, b) => a.stockQty - b.stockQty);
  }

  get topProductsByValue(): ApiProduct[] {
    return [...this.apiProducts]
      .sort((a, b) => b.totalStockValue - a.totalStockValue)
      .slice(0, 5);
  }

  get recentTransactions(): Transaction[] {
    return this.transactions
      .sort((a, b) => b.date.localeCompare(a.date))
      .slice(0, 10);
  }

  get filteredTopProducts(): ApiProduct[] {
    const q = this.topProductsSearch.toLowerCase().trim();
    return this.topProductsByValue.filter(p =>
      !q || p.productName.toLowerCase().includes(q) || (p.categoryName || '').toLowerCase().includes(q)
    );
  }


  get dailyPerformance(): DailyStats[] {
    const last7Days = [];
    const today = new Date();

    for (let i = 6; i >= 0; i--) {
      const date = new Date(today);
      date.setDate(today.getDate() - i);
      const dateStr = toLocalDateString(date);

      const sales = this.transactions
        .filter(t => t.type === 'sale' && t.date === dateStr)
        .reduce((sum, t) => sum + t.amount, 0);
      const purchases = this.transactions
        .filter(t => t.type === 'purchase' && t.date === dateStr)
        .reduce((sum, t) => sum + t.amount, 0);

      last7Days.push({
        date: dateStr,
        sales: sales,
        purchases: purchases,
        profit: sales - purchases
      });
    }
    return last7Days;
  }

  get maxDailyValue(): number {
    const maxSales = Math.max(...this.dailyPerformance.map(d => d.sales));
    const maxPurchases = Math.max(...this.dailyPerformance.map(d => d.purchases));
    return Math.max(maxSales, maxPurchases, 100);
  }

  getBarHeight(value: number, max: number): number {
    return (value / max) * 120;
  }

  filterByDate() {
    this.activeQuick = '';   // manual date edit clears active pill
    this.loadPurchaseSummary();
    this.loadSalesSummary();
  }

  resetDateFilter() {
    this.startDate  = this.todayDate;
    this.endDate    = this.todayDate;
    this.activeQuick = 'today';
    this.loadPurchaseSummary();
    this.loadSalesSummary();
  }

  /** Called by the pill buttons — replaces the old select-based quickFilter */
  applyQuick(value: string) {
    const today    = new Date();
    const todayStr = toLocalDateString(today);

    switch (value) {
      case 'today':
        this.startDate = todayStr;
        this.endDate   = todayStr;
        break;
      case 'yesterday': {
        const d = new Date(today);
        d.setDate(today.getDate() - 1);
        const s = toLocalDateString(d);
        this.startDate = s;
        this.endDate   = s;
        break;
      }
      case 'week': {
        const d = new Date(today);
        d.setDate(today.getDate() - today.getDay());
        this.startDate = toLocalDateString(d);
        this.endDate   = todayStr;
        break;
      }
      case 'month': {
        const d = new Date(today.getFullYear(), today.getMonth(), 1);
        this.startDate = toLocalDateString(d);
        this.endDate   = todayStr;
        break;
      }
      case 'quarter': {
        const d = new Date(today.getFullYear(), Math.floor(today.getMonth() / 3) * 3, 1);
        this.startDate = toLocalDateString(d);
        this.endDate   = todayStr;
        break;
      }
      default: return;
    }

    this.activeQuick = value;
    this.loadPurchaseSummary();
    this.loadSalesSummary();
  }

  /** @deprecated kept for backward compat — use applyQuick() */
  quickFilter(event: Event) {
    const value = (event.target as HTMLSelectElement).value;
    this.applyQuick(value);
  }
}
