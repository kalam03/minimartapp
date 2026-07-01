import { Component, OnInit, ChangeDetectorRef } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { CustomerService } from '../../services/customer.service';
import { PurchaseService, PurchaseSummaryDto } from '../../services/purchase.service';
import { SaleService, SalesSummaryDto, DailyPerformanceDto } from '../../services/sale.service';

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

interface Product {
  id: number;
  name: string;
  category: string;
  stock: number;
  reorderLevel: number;
  purchasePrice: number;
  sellingPrice: number;
  location?: string;
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
  imports: [CommonModule, FormsModule],
  template: `
    <div class="px-3 py-2">
      <div class="max-w-8xl mx-auto">

        <!-- Date Filter -->
        <div class="bg-white rounded-xl shadow-md border mb-3 p-4">
          <div class="flex flex-wrap gap-4 items-end">
            <div>
              <label class="block text-sm font-semibold mb-1" style="color:#1a1c4e">Start Date</label>
              <input type="date" [(ngModel)]="startDate" (change)="filterByDate()"
                class="px-4 py-2.5 text-base border border-gray-400 rounded-lg outline-none w-[220px]">
            </div>
            <div>
              <label class="block text-sm font-semibold mb-1" style="color:#1a1c4e">End Date</label>
              <input type="date" [(ngModel)]="endDate" (change)="filterByDate()"
                class="px-4 py-2.5 text-base border border-gray-400 rounded-lg outline-none w-[220px]">
            </div>
            <div>
              <label class="block text-sm font-semibold mb-1" style="color:#1a1c4e">Quick Filter</label>
              <select (change)="quickFilter($event)"
                class="px-4 py-2.5 text-base border border-gray-400 rounded-lg outline-none w-[220px]">
                <option value="">Custom Range</option>
                <option value="today">Today</option>
                <option value="yesterday">Yesterday</option>
                <option value="week">This Week</option>
                <option value="month">This Month</option>
                <option value="quarter">This Quarter</option>
              </select>
            </div>
            <button (click)="resetDateFilter()"
              class="px-4 py-2 text-sm rounded-lg font-semibold transition" style="background:#ACB3E7;color:#1a1c4e"
              onmouseover="this.style.background='#c8ccee'" onmouseout="this.style.background='#ACB3E7'">
              Reset
            </button>
          </div>
        </div>

        <!-- Sales Summary from API -->
        <div class="bg-white rounded-xl shadow-md border overflow-hidden mb-3">
          <div class="px-3 py-2 flex items-center justify-between" style="background:#1a1c4e">
            <h3 class="text-white font-semibold text-sm">Sales Summary</h3>
            <span *ngIf="salesSummaryLoading" class="text-xs" style="color:#ACB3E7">Loading…</span>
            <span *ngIf="!salesSummaryLoading" class="text-xs" style="color:#ACB3E7">{{ startDate }} → {{ endDate }}</span>
          </div>
          <div class="grid grid-cols-2 sm:grid-cols-4 lg:grid-cols-7 divide-x divide-y sm:divide-y-0 divide-gray-100">
            <div class="px-3 py-2 text-center">
              <p class="text-xs text-gray-400 mb-0.5">Invoices</p>
              <p class="text-base font-bold" style="color:#1a1c4e">{{ salesSummary.totalInvoices }}</p>
            </div>
            <div class="px-3 py-2 text-center">
              <p class="text-xs text-gray-400 mb-0.5">Total Sales</p>
              <p class="text-base font-bold" style="color:#1a1c4e">৳{{ salesSummary.totalSales | number:'1.2-2' }}</p>
            </div>
            <div class="px-3 py-2 text-center">
              <p class="text-xs text-gray-400 mb-0.5">Discount</p>
              <p class="text-base font-bold text-green-600">৳{{ salesSummary.totalDiscount | number:'1.2-2' }}</p>
            </div>
            <div class="px-3 py-2 text-center">
              <p class="text-xs text-gray-400 mb-0.5">Transport</p>
              <p class="text-base font-bold text-orange-500">৳{{ salesSummary.totalTransport | number:'1.2-2' }}</p>
            </div>
            <div class="px-3 py-2 text-center">
              <p class="text-xs text-gray-400 mb-0.5">Net Amount</p>
              <p class="text-base font-bold" style="color:#1a1c4e">৳{{ salesSummary.totalNetAmount | number:'1.2-2' }}</p>
            </div>
            <div class="px-3 py-2 text-center">
              <p class="text-xs text-gray-400 mb-0.5">Paid</p>
              <p class="text-base font-bold text-green-600">৳{{ salesSummary.totalPaid | number:'1.2-2' }}</p>
            </div>
            <div class="px-3 py-2 text-center">
              <p class="text-xs text-gray-400 mb-0.5">Due</p>
              <p class="text-base font-bold text-red-600">৳{{ salesSummary.totalDue | number:'1.2-2' }}</p>
            </div>
          </div>
        </div>

        <!-- Purchase Summary from API -->
        <div class="bg-white rounded-xl shadow-md border overflow-hidden mb-3">
          <div class="px-3 py-2 flex items-center justify-between" style="background:#1a1c4e">
            <h3 class="text-white font-semibold text-sm">Purchase Summary</h3>
            <span *ngIf="purchaseSummaryLoading" class="text-xs" style="color:#ACB3E7">Loading…</span>
            <span *ngIf="!purchaseSummaryLoading" class="text-xs" style="color:#ACB3E7">{{ startDate }} → {{ endDate }}</span>
          </div>
          <div class="grid grid-cols-2 sm:grid-cols-4 lg:grid-cols-7 divide-x divide-y sm:divide-y-0 divide-gray-100">
            <div class="px-3 py-2 text-center">
              <p class="text-xs text-gray-400 mb-0.5">Invoices</p>
              <p class="text-base font-bold" style="color:#1a1c4e">{{ purchaseSummary.totalInvoices }}</p>
            </div>
            <div class="px-3 py-2 text-center">
              <p class="text-xs text-gray-400 mb-0.5">Total Purchase</p>
              <p class="text-base font-bold" style="color:#1a1c4e">৳{{ purchaseSummary.totalPurchase | number:'1.2-2' }}</p>
            </div>
            <div class="px-3 py-2 text-center">
              <p class="text-xs text-gray-400 mb-0.5">Discount</p>
              <p class="text-base font-bold text-green-600">৳{{ purchaseSummary.totalDiscount | number:'1.2-2' }}</p>
            </div>
            <div class="px-3 py-2 text-center">
              <p class="text-xs text-gray-400 mb-0.5">Transport</p>
              <p class="text-base font-bold text-orange-500">৳{{ purchaseSummary.totalTransport | number:'1.2-2' }}</p>
            </div>
            <div class="px-3 py-2 text-center">
              <p class="text-xs text-gray-400 mb-0.5">Net Amount</p>
              <p class="text-base font-bold" style="color:#1a1c4e">৳{{ purchaseSummary.totalNetAmount | number:'1.2-2' }}</p>
            </div>
            <div class="px-3 py-2 text-center">
              <p class="text-xs text-gray-400 mb-0.5">Paid</p>
              <p class="text-base font-bold text-green-600">৳{{ purchaseSummary.totalPaid | number:'1.2-2' }}</p>
            </div>
            <div class="px-3 py-2 text-center">
              <p class="text-xs text-gray-400 mb-0.5">Due</p>
              <p class="text-base font-bold text-red-600">৳{{ purchaseSummary.totalDue | number:'1.2-2' }}</p>
            </div>
          </div>
        </div>

        <!-- KPI Cards Row 1 -->
        <div class="grid grid-cols-2 lg:grid-cols-4 gap-3 mb-3">
          <div class="bg-white rounded-xl shadow-md border overflow-hidden">
            <div class="px-3 py-2 flex items-center justify-between" style="background:#1a1c4e">
              <p class="text-xs font-semibold" style="color:#ACB3E7">Total Sales</p>
              <svg class="w-4 h-4" fill="none" stroke="#ACB3E7" viewBox="0 0 24 24">
                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 8c-1.657 0-3 .895-3 2s1.343 2 3 2 3 .895 3 2-1.343 2-3 2m0-8c1.11 0 2.08.402 2.599 1M12 8V7m0 1v8m0 0v1m0-1c-1.11 0-2.08-.402-2.599-1M21 12a9 9 0 11-18 0 9 9 0 0118 0z"></path>
              </svg>
            </div>
            <div class="px-3 py-2">
              <p class="text-xl font-bold" style="color:#1a1c4e">৳{{ salesSummary.totalNetAmount | number:'1.2-2' }}</p>
              <p class="text-xs text-gray-400 mt-1">Net Amount</p>
              <p class="text-xs text-gray-400 mt-0.5">Invoices: {{ salesSummary.totalInvoices }}</p>
            </div>
          </div>

          <div class="bg-white rounded-xl shadow-md border overflow-hidden">
            <div class="px-3 py-2 flex items-center justify-between" style="background:#1a1c4e">
              <p class="text-xs font-semibold" style="color:#ACB3E7">Total Purchases</p>
              <svg class="w-4 h-4" fill="none" stroke="#ACB3E7" viewBox="0 0 24 24">
                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M16 11V7a4 4 0 00-8 0v4M5 9h14l1 12H4L5 9z"></path>
              </svg>
            </div>
            <div class="px-3 py-2">
              <p class="text-xl font-bold" style="color:#1a1c4e">৳{{ purchaseSummary.totalNetAmount | number:'1.2-2' }}</p>
              <p class="text-xs text-gray-400 mt-1">Net Amount</p>
              <p class="text-xs text-gray-400 mt-0.5">Invoices: {{ purchaseSummary.totalInvoices }}</p>
            </div>
          </div>

          <div class="bg-white rounded-xl shadow-md border overflow-hidden">
            <div class="px-3 py-2 flex items-center justify-between" style="background:#1a1c4e">
              <p class="text-xs font-semibold" style="color:#ACB3E7">Net Profit</p>
              <svg class="w-4 h-4" fill="none" stroke="#ACB3E7" viewBox="0 0 24 24">
                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z"></path>
              </svg>
            </div>
            <div class="px-3 py-2">
              <p class="text-xl font-bold"
                [class.text-green-600]="(salesSummary.totalNetAmount - purchaseSummary.totalNetAmount) >= 0"
                [class.text-red-600]="(salesSummary.totalNetAmount - purchaseSummary.totalNetAmount) < 0">
                ৳{{ (salesSummary.totalNetAmount - purchaseSummary.totalNetAmount) | number:'1.2-2' }}
              </p>
              <p class="text-xs text-gray-400 mt-1">Sales Net − Purchase Net</p>
            </div>
          </div>

          <div class="bg-white rounded-xl shadow-md border overflow-hidden">
            <div class="px-3 py-2 flex items-center justify-between" style="background:#1a1c4e">
              <p class="text-xs font-semibold" style="color:#ACB3E7">Transactions</p>
              <svg class="w-4 h-4" fill="none" stroke="#ACB3E7" viewBox="0 0 24 24">
                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2"></path>
              </svg>
            </div>
            <div class="px-3 py-2">
              <p class="text-xl font-bold" style="color:#1a1c4e">{{ salesSummary.totalInvoices + purchaseSummary.totalInvoices }}</p>
              <div class="flex gap-3 mt-1 text-xs">
                <span class="text-green-600">Sales: {{ salesSummary.totalInvoices }}</span>
                <span class="text-orange-500">Purchase: {{ purchaseSummary.totalInvoices }}</span>
              </div>
            </div>
          </div>
        </div>

        <!-- KPI Cards Row 2 -->
        <div class="grid grid-cols-2 lg:grid-cols-4 gap-3 mb-3">
          <div class="rounded-xl border overflow-hidden" style="background:#1a1c4e">
            <div class="px-3 py-2 border-b border-white border-opacity-10">
              <p class="text-xs font-semibold" style="color:#ACB3E7">Total Customers</p>
            </div>
            <div class="px-3 py-2">
              <p class="text-xl font-bold text-white">{{ totalCustomers }}</p>
              <p class="text-xs mt-1" style="color:#ACB3E7">Active accounts</p>
              <p class="text-xs mt-1 text-white opacity-70">Due: ৳{{ totalCustomerDue | number:'1.2-2' }}</p>
            </div>
          </div>

          <div class="rounded-xl border overflow-hidden" style="background:#252862">
            <div class="px-3 py-2 border-b border-white border-opacity-10">
              <p class="text-xs font-semibold" style="color:#ACB3E7">Total Suppliers</p>
            </div>
            <div class="px-3 py-2">
              <p class="text-xl font-bold text-white">{{ totalSuppliers }}</p>
              <p class="text-xs mt-1" style="color:#ACB3E7">Active vendors</p>
              <p class="text-xs mt-1 text-white opacity-70">Debt: ৳{{ totalSupplierDebt | number:'1.2-2' }}</p>
            </div>
          </div>

          <div class="rounded-xl border overflow-hidden" style="background:#3a3d7a">
            <div class="px-3 py-2 border-b border-white border-opacity-10">
              <p class="text-xs font-semibold" style="color:#ACB3E7">Inventory Value</p>
            </div>
            <div class="px-3 py-2">
              <p class="text-xl font-bold text-white">৳{{ inventoryValue | number:'1.0-0' }}</p>
              <p class="text-xs mt-1" style="color:#ACB3E7">{{ totalProducts }} products</p>
              <p class="text-xs mt-1 text-white opacity-70">Low stock: {{ lowStockProducts.length }}</p>
            </div>
          </div>

          <div class="rounded-xl border overflow-hidden" style="background:#1a1c4e">
            <div class="px-3 py-2 border-b border-white border-opacity-10">
              <p class="text-xs font-semibold" style="color:#ACB3E7">Avg. Transaction</p>
            </div>
            <div class="px-3 py-2">
              <p class="text-xl font-bold text-white">৳{{ avgTransactionValue | number:'1.2-2' }}</p>
              <p class="text-xs mt-1" style="color:#ACB3E7">Per transaction</p>
            </div>
          </div>
        </div>

        <!-- Daily Performance -->
        <div class="bg-white rounded-xl shadow-md border overflow-hidden mb-3">
          <div class="px-3 py-2 flex items-center justify-between" style="background:#1a1c4e">
            <h3 class="text-white font-semibold text-sm">Daily Performance (Last 7 Days)</h3>
            <div class="flex gap-3">
              <span class="flex items-center gap-1 text-xs" style="color:#ACB3E7">
                <span class="inline-block w-3 h-3 rounded" style="background:#4ade80"></span> Sales
              </span>
              <span class="flex items-center gap-1 text-xs" style="color:#ACB3E7">
                <span class="inline-block w-3 h-3 rounded" style="background:#fb923c"></span> Purchases
              </span>
            </div>
          </div>
          <div class="p-3 overflow-x-auto">
            <div *ngIf="apiDailyPerformance.length === 0" class="text-center py-6 text-gray-400 text-sm">
              No data for the last 7 days
            </div>
            <div class="flex gap-6 min-w-max" *ngIf="apiDailyPerformance.length > 0">
              <div *ngFor="let day of apiDailyPerformance" class="flex flex-col items-center">
                <div class="text-xs text-gray-500 mb-1">{{ day.date | date:'MMM dd' }}</div>
                <div class="flex gap-1 items-end h-24">
                  <div class="w-6 rounded-t transition-all" style="background:#4ade80;min-height:2px"
                       [style.height.px]="getBarHeight(day.totalSales, apiMaxDailyValue)"
                       [title]="'Sales: ৳' + day.totalSales"></div>
                  <div class="w-6 rounded-t transition-all" style="background:#fb923c;min-height:2px"
                       [style.height.px]="getBarHeight(day.totalPurchases, apiMaxDailyValue)"
                       [title]="'Purchases: ৳' + day.totalPurchases"></div>
                </div>
                <div class="text-xs font-semibold mt-1"
                     [class.text-green-600]="day.profit >= 0"
                     [class.text-red-500]="day.profit < 0">
                  ৳{{ day.profit | number:'1.0-0' }}
                </div>
              </div>
            </div>
          </div>
        </div>

        <!-- Customer Due & Supplier Debt -->
        <div class="grid grid-cols-1 lg:grid-cols-2 gap-3 mb-3">

          <!-- Customer Due -->
          <div class="bg-white rounded-xl shadow-md border overflow-hidden">
            <div class="px-3 py-2 flex items-center justify-between" style="background:#1a1c4e">
              <h3 class="text-white font-semibold text-sm">Customers by Due Amount</h3>
              <span class="text-xs" style="color:#ACB3E7">{{ customerDueTotal }} total</span>
            </div>
            <div class="px-3 py-2 border-b">
              <input type="text" [(ngModel)]="customerDueSearch" (input)="customerDuePage=1; loadCustomerDue()"
                placeholder="Search by name or phone…"
                class="w-full px-2 py-1 text-xs border border-gray-300 rounded-lg outline-none">
            </div>
            <div class="overflow-x-auto">
              <table class="w-full text-xs">
                <thead style="background:#1a1c4e;color:#e0e3f8">
                  <tr>
                    <th class="px-3 py-2 text-left">#</th>
                    <th class="px-3 py-2 text-left">Customer</th>
                    <th class="px-3 py-2 text-left">Phone</th>
                    <th class="px-3 py-2 text-right">Due Amount</th>
                  </tr>
                </thead>
                <tbody class="divide-y divide-gray-100">
                  <tr *ngFor="let c of customerDueList; let i = index" class="hover:bg-gray-50 transition">
                    <td class="px-3 py-2 text-gray-500">{{ (customerDuePage-1)*customerDuePageSize + i + 1 }}</td>
                    <td class="px-3 py-2 font-medium text-gray-800">{{ c.customerName }}</td>
                    <td class="px-3 py-2 text-gray-500">{{ c.phone || '-' }}</td>
                    <td class="px-3 py-2 text-right font-bold text-red-600">৳{{ c.dueAmount | number:'1.2-2' }}</td>
                  </tr>
                  <tr *ngIf="customerDueList.length === 0">
                    <td colspan="4" class="px-3 py-4 text-center text-gray-400">No records found</td>
                  </tr>
                </tbody>
              </table>
            </div>
            <div class="px-3 py-1.5 bg-gray-50 border-t flex items-center justify-between text-xs">
              <span class="text-gray-500">Page {{ customerDuePage }} of {{ customerDueTotalPages }}</span>
              <div class="flex gap-1">
                <button (click)="customerDuePage=customerDuePage-1; loadCustomerDue()" [disabled]="customerDuePage===1"
                  class="px-2 py-1 border rounded disabled:opacity-40 hover:bg-gray-100">←</button>
                <select [(ngModel)]="customerDuePageSize" (change)="customerDuePage=1; loadCustomerDue()"
                  class="px-1 py-1 border rounded text-xs">
                  <option [value]="10">10</option><option [value]="25">25</option><option [value]="50">50</option>
                </select>
                <button (click)="customerDuePage=customerDuePage+1; loadCustomerDue()" [disabled]="customerDuePage>=customerDueTotalPages"
                  class="px-2 py-1 border rounded disabled:opacity-40 hover:bg-gray-100">→</button>
              </div>
            </div>
          </div>

          <!-- Supplier Due -->
          <div class="bg-white rounded-xl shadow-md border overflow-hidden">
            <div class="px-3 py-2 flex items-center justify-between" style="background:#1a1c4e">
              <h3 class="text-white font-semibold text-sm">Suppliers by Due Amount</h3>
              <span class="text-xs" style="color:#ACB3E7">{{ supplierDueTotal }} total</span>
            </div>
            <div class="px-3 py-2 border-b">
              <input type="text" [(ngModel)]="supplierDueSearch" (input)="supplierDuePage=1; loadSupplierDue()"
                placeholder="Search by name or phone…"
                class="w-full px-2 py-1 text-xs border border-gray-300 rounded-lg outline-none">
            </div>
            <div class="overflow-x-auto">
              <table class="w-full text-xs">
                <thead style="background:#1a1c4e;color:#e0e3f8">
                  <tr>
                    <th class="px-3 py-2 text-left">#</th>
                    <th class="px-3 py-2 text-left">Supplier</th>
                    <th class="px-3 py-2 text-left">Phone</th>
                    <th class="px-3 py-2 text-right">Due Amount</th>
                  </tr>
                </thead>
                <tbody class="divide-y divide-gray-100">
                  <tr *ngFor="let s of supplierDueList; let i = index" class="hover:bg-gray-50 transition">
                    <td class="px-3 py-2 text-gray-500">{{ (supplierDuePage-1)*supplierDuePageSize + i + 1 }}</td>
                    <td class="px-3 py-2 font-medium text-gray-800">{{ s.supplierName }}</td>
                    <td class="px-3 py-2 text-gray-500">{{ s.phone || '-' }}</td>
                    <td class="px-3 py-2 text-right font-bold text-orange-600">৳{{ s.dueAmount | number:'1.2-2' }}</td>
                  </tr>
                  <tr *ngIf="supplierDueList.length === 0">
                    <td colspan="4" class="px-3 py-4 text-center text-gray-400">No records found</td>
                  </tr>
                </tbody>
              </table>
            </div>
            <div class="px-3 py-1.5 bg-gray-50 border-t flex items-center justify-between text-xs">
              <span class="text-gray-500">Page {{ supplierDuePage }} of {{ supplierDueTotalPages }}</span>
              <div class="flex gap-1">
                <button (click)="supplierDuePage=supplierDuePage-1; loadSupplierDue()" [disabled]="supplierDuePage===1"
                  class="px-2 py-1 border rounded disabled:opacity-40 hover:bg-gray-100">←</button>
                <select [(ngModel)]="supplierDuePageSize" (change)="supplierDuePage=1; loadSupplierDue()"
                  class="px-1 py-1 border rounded text-xs">
                  <option [value]="10">10</option><option [value]="25">25</option><option [value]="50">50</option>
                </select>
                <button (click)="supplierDuePage=supplierDuePage+1; loadSupplierDue()" [disabled]="supplierDuePage>=supplierDueTotalPages"
                  class="px-2 py-1 border rounded disabled:opacity-40 hover:bg-gray-100">→</button>
              </div>
            </div>
          </div>
        </div>

        <!-- Low Stock Alert + Top Products (side by side, 6 col each) -->
        <div class="grid grid-cols-1 lg:grid-cols-2 gap-3 mb-3">
        <div class="bg-white rounded-xl shadow-md border overflow-hidden">
          <div class="px-3 py-2 flex items-center justify-between" style="background:#1a1c4e">
            <h3 class="text-white font-semibold text-sm">Low Stock Alert</h3>
            <div class="flex items-center gap-2">
              <span class="text-xs" style="color:#ACB3E7">Threshold ≤</span>
              <input type="number" [(ngModel)]="lowStockThreshold" (change)="lowStockPage=1; loadLowStock()"
                class="w-14 px-1 py-0.5 text-xs border rounded text-center" min="1">
              <span class="text-xs" style="color:#ACB3E7">{{ lowStockTotal }} items</span>
            </div>
          </div>
          <div class="px-3 py-2 border-b">
            <input type="text" [(ngModel)]="lowStockSearch" (input)="lowStockPage=1; loadLowStock()"
              placeholder="Search by product name or barcode…"
              class="w-full px-2 py-1 text-xs border border-gray-300 rounded-lg outline-none">
          </div>
          <div class="overflow-x-auto">
            <table class="w-full text-xs">
              <thead style="background:#1a1c4e;color:#e0e3f8">
                <tr>
                  <th class="px-3 py-2 text-left">#</th>
                  <th class="px-3 py-2 text-left">Product</th>
                  <th class="px-3 py-2 text-left">Category</th>
                  <th class="px-3 py-2 text-left">Barcode</th>
                  <th class="px-3 py-2 text-right">Stock Qty</th>
                  <th class="px-3 py-2 text-right">Purchase Price</th>
                  <th class="px-3 py-2 text-right">Sale Price</th>
                  <th class="px-3 py-2 text-center">Status</th>
                </tr>
              </thead>
              <tbody class="divide-y divide-gray-100">
                <tr *ngFor="let p of lowStockList; let i = index" class="hover:bg-gray-50 transition">
                  <td class="px-3 py-2 text-gray-500">{{ (lowStockPage-1)*lowStockPageSize + i + 1 }}</td>
                  <td class="px-3 py-2 font-medium text-gray-800">{{ p.productName }}</td>
                  <td class="px-3 py-2 text-gray-500">{{ p.categoryName }}</td>
                  <td class="px-3 py-2 text-gray-400 font-mono">{{ p.barcode || '-' }}</td>
                  <td class="px-3 py-2 text-right font-bold text-red-600">{{ p.stockQty }}</td>
                  <td class="px-3 py-2 text-right text-gray-600">৳{{ p.purchasePrice | number:'1.2-2' }}</td>
                  <td class="px-3 py-2 text-right text-gray-600">৳{{ p.salePrice | number:'1.2-2' }}</td>
                  <td class="px-3 py-2 text-center">
                    <span class="px-2 py-0.5 rounded-full font-medium"
                      [class.bg-red-100]="p.stockQty === 0" [class.text-red-700]="p.stockQty === 0"
                      [class.bg-orange-100]="p.stockQty > 0" [class.text-orange-700]="p.stockQty > 0">
                      {{ p.stockQty === 0 ? 'Out of Stock' : 'Low Stock' }}
                    </span>
                  </td>
                </tr>
                <tr *ngIf="lowStockList.length === 0">
                  <td colspan="8" class="px-3 py-4 text-center text-gray-400">No low stock items found</td>
                </tr>
              </tbody>
            </table>
          </div>
          <div class="px-3 py-1.5 bg-gray-50 border-t flex items-center justify-between text-xs">
            <span class="text-gray-500">Page {{ lowStockPage }} of {{ lowStockTotalPages }}</span>
            <div class="flex gap-1">
              <button (click)="lowStockPage=lowStockPage-1; loadLowStock()" [disabled]="lowStockPage===1"
                class="px-2 py-1 border rounded disabled:opacity-40 hover:bg-gray-100">←</button>
              <select [(ngModel)]="lowStockPageSize" (change)="lowStockPage=1; loadLowStock()"
                class="px-1 py-1 border rounded text-xs">
                <option [value]="10">10</option><option [value]="25">25</option><option [value]="50">50</option>
              </select>
              <button (click)="lowStockPage=lowStockPage+1; loadLowStock()" [disabled]="lowStockPage>=lowStockTotalPages"
                class="px-2 py-1 border rounded disabled:opacity-40 hover:bg-gray-100">→</button>
            </div>
          </div>
        </div>

          <!-- Top Products by Inventory Value -->
          <div class="bg-white rounded-xl shadow-md border overflow-hidden">
            <div class="px-3 py-2" style="background:#1a1c4e">
              <h3 class="text-white font-semibold text-sm">Top Products by Inventory Value</h3>
            </div>
            <div class="px-3 py-2 border-b">
              <input type="text" [(ngModel)]="topProductsSearch" placeholder="Search by product name or category…"
                class="w-full px-2 py-1 text-xs border border-gray-300 rounded-lg outline-none">
            </div>
            <div class="overflow-x-auto">
              <table class="w-full text-xs">
                <thead style="background:#1a1c4e;color:#e0e3f8">
                  <tr>
                    <th class="px-3 py-2 text-left">Product</th>
                    <th class="px-3 py-2 text-left">Category</th>
                    <th class="px-3 py-2 text-right">Stock</th>
                    <th class="px-3 py-2 text-right">Unit Price</th>
                    <th class="px-3 py-2 text-right">Total Value</th>
                  </tr>
                </thead>
                <tbody class="divide-y divide-gray-100">
                  <tr *ngFor="let p of filteredTopProducts" class="hover:bg-gray-50 transition">
                    <td class="px-3 py-2 font-medium text-gray-800">{{ p.name }}</td>
                    <td class="px-3 py-2 text-gray-500">{{ p.category }}</td>
                    <td class="px-3 py-2 text-right text-gray-600">{{ p.stock }}</td>
                    <td class="px-3 py-2 text-right text-gray-600">৳{{ p.purchasePrice | number:'1.2-2' }}</td>
                    <td class="px-3 py-2 text-right font-semibold" style="color:#1a1c4e">৳{{ (p.stock * p.purchasePrice) | number:'1.2-2' }}</td>
                  </tr>
                  <tr *ngIf="filteredTopProducts.length === 0">
                    <td colspan="5" class="px-3 py-4 text-center text-gray-400">No products match</td>
                  </tr>
                </tbody>
              </table>
            </div>
          </div>
        </div>

        <!-- Recent Transactions (live from GL_TRANSACTION) -->
        <div class="bg-white rounded-xl shadow-md border overflow-hidden">
          <div class="px-3 py-2 flex items-center justify-between" style="background:#1a1c4e">
            <h3 class="text-white font-semibold text-sm">Recent Transactions</h3>
            <span class="text-xs" style="color:#ACB3E7">{{ recentTxnTotal }} total</span>
          </div>
          <!-- Summary bar -->
          <div class="grid grid-cols-3 divide-x border-b" style="background:#f5f6fd">
            <div class="px-4 py-2 text-center">
              <p class="text-xs text-gray-400 mb-0.5">Total Debit</p>
              <p class="text-sm font-bold text-orange-600">৳{{ recentTxnTotalDebit | number:'1.2-2' }}</p>
            </div>
            <div class="px-4 py-2 text-center">
              <p class="text-xs text-gray-400 mb-0.5">Total Credit</p>
              <p class="text-sm font-bold text-green-600">৳{{ recentTxnTotalCredit | number:'1.2-2' }}</p>
            </div>
            <div class="px-4 py-2 text-center">
              <p class="text-xs text-gray-400 mb-0.5">Revenue (C − D)</p>
              <p class="text-sm font-bold"
                [class.text-green-600]="recentRevenue >= 0"
                [class.text-red-600]="recentRevenue < 0">৳{{ recentRevenue | number:'1.2-2' }}</p>
            </div>
          </div>
          <!-- Search / Filter -->
          <div class="px-3 py-2 border-b flex gap-2">
            <input type="text" [(ngModel)]="recentTxnSearch" (input)="recentTxnPage=1; loadRecentTransactions()"
              placeholder="Search by TXN no, reference, GL account, narration…"
              class="flex-1 px-2 py-1 text-xs border border-gray-300 rounded-lg outline-none">
            <select [(ngModel)]="recentTxnTypeFilter" (change)="recentTxnPage=1; loadRecentTransactions()"
              class="px-2 py-1 text-xs border border-gray-300 rounded-lg outline-none">
              <option value="">All (D/C)</option>
              <option value="D">Debit only</option>
              <option value="C">Credit only</option>
            </select>
          </div>
          <!-- Table -->
          <div class="overflow-x-auto">
            <table class="w-full text-xs">
              <thead style="background:#1a1c4e;color:#e0e3f8">
                <tr>
                  <th class="px-3 py-2 text-left">#</th>
                  <th class="px-3 py-2 text-left">Date</th>
                  <th class="px-3 py-2 text-left">TXN No</th>
                  <th class="px-3 py-2 text-left">Reference</th>
                  <th class="px-3 py-2 text-left">GL Account</th>
                  <th class="px-3 py-2 text-left">Mode</th>
                  <th class="px-3 py-2 text-center">D/C</th>
                  <th class="px-3 py-2 text-right">Amount</th>
                  <th class="px-3 py-2 text-left">Narration</th>
                  <th class="px-3 py-2 text-center">Status</th>
                </tr>
              </thead>
              <tbody class="divide-y divide-gray-100">
                <tr *ngFor="let t of recentTxnList; let i = index" class="hover:bg-gray-50 transition">
                  <td class="px-3 py-2 text-gray-500">{{ (recentTxnPage-1)*recentTxnPageSize + i + 1 }}</td>
                  <td class="px-3 py-2 text-gray-600 whitespace-nowrap">{{ t.txnDate | date:'dd MMM yy' }}</td>
                  <td class="px-3 py-2 font-medium" style="color:#1a1c4e">{{ t.txnNo }}</td>
                  <td class="px-3 py-2 text-gray-500">{{ t.referenceNo || '-' }}</td>
                  <td class="px-3 py-2 font-mono text-gray-600">{{ t.glAccount }}</td>
                  <td class="px-3 py-2 text-gray-500">{{ t.txnMode || '-' }}</td>
                  <td class="px-3 py-2 text-center">
                    <span class="px-2 py-0.5 rounded-full font-medium"
                      [class.bg-orange-100]="t.drCr==='D'" [class.text-orange-700]="t.drCr==='D'"
                      [class.bg-green-100]="t.drCr==='C'" [class.text-green-700]="t.drCr==='C'">
                      {{ t.drCr === 'D' ? 'Debit' : 'Credit' }}
                    </span>
                  </td>
                  <td class="px-3 py-2 text-right font-semibold"
                    [class.text-orange-600]="t.drCr==='D'"
                    [class.text-green-600]="t.drCr==='C'">
                    ৳{{ t.amount | number:'1.2-2' }}
                  </td>
                  <td class="px-3 py-2 text-gray-500 max-w-[160px] truncate">{{ t.narration || '-' }}</td>
                  <td class="px-3 py-2 text-center">
                    <span class="px-2 py-0.5 rounded-full font-medium"
                      [class.bg-green-100]="t.authStatus==='A'" [class.text-green-700]="t.authStatus==='A'"
                      [class.bg-yellow-100]="t.authStatus!=='A'" [class.text-yellow-700]="t.authStatus!=='A'">
                      {{ t.authStatus === 'A' ? 'Approved' : 'Pending' }}
                    </span>
                  </td>
                </tr>
                <tr *ngIf="recentTxnList.length === 0">
                  <td colspan="10" class="px-3 py-4 text-center text-gray-400">No transactions found</td>
                </tr>
              </tbody>
            </table>
          </div>
          <!-- Pagination -->
          <div class="px-3 py-1.5 bg-gray-50 border-t flex items-center justify-between text-xs">
            <span class="text-gray-500">Page {{ recentTxnPage }} of {{ recentTxnTotalPages }}</span>
            <div class="flex gap-1">
              <button (click)="recentTxnPage=recentTxnPage-1; loadRecentTransactions()" [disabled]="recentTxnPage===1"
                class="px-2 py-1 border rounded disabled:opacity-40 hover:bg-gray-100">←</button>
              <select [(ngModel)]="recentTxnPageSize" (change)="recentTxnPage=1; loadRecentTransactions()"
                class="px-1 py-1 border rounded text-xs">
                <option [value]="10">10</option><option [value]="20">20</option><option [value]="50">50</option>
              </select>
              <button (click)="recentTxnPage=recentTxnPage+1; loadRecentTransactions()" [disabled]="recentTxnPage>=recentTxnTotalPages"
                class="px-2 py-1 border rounded disabled:opacity-40 hover:bg-gray-100">→</button>
            </div>
          </div>
        </div>

      </div>
    </div>
  `,
  styles: [`
    :host {
      display: block;
    }
  `]
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
    // Recent Sales
    { id: 1, date: '2026-04-19', amount: 1250, type: 'sale', partyId: 1, partyName: 'John Electronics', paymentStatus: 'paid', paymentMethod: 'card' },
    { id: 2, date: '2026-04-19', amount: 850, type: 'sale', partyId: 2, partyName: 'Sarah Stores', paymentStatus: 'partial', paymentMethod: 'cash' },
    { id: 3, date: '2026-04-19', amount: 2100, type: 'sale', partyId: 3, partyName: 'Mike Retail', paymentStatus: 'pending', paymentMethod: 'bank' },
    { id: 4, date: '2026-04-18', amount: 3200, type: 'sale', partyId: 4, partyName: 'Tech Solutions', paymentStatus: 'paid', paymentMethod: 'card' },
    { id: 5, date: '2026-04-18', amount: 450, type: 'sale', partyId: 5, partyName: 'Home Center', paymentStatus: 'paid', paymentMethod: 'cash' },
    { id: 6, date: '2026-04-17', amount: 1875, type: 'sale', partyId: 1, partyName: 'John Electronics', paymentStatus: 'paid', paymentMethod: 'card' },
    { id: 7, date: '2026-04-16', amount: 950, type: 'sale', partyId: 2, partyName: 'Sarah Stores', paymentStatus: 'partial', paymentMethod: 'cash' },
    { id: 8, date: '2026-04-15', amount: 4300, type: 'sale', partyId: 3, partyName: 'Mike Retail', paymentStatus: 'paid', paymentMethod: 'bank' },
    { id: 9, date: '2026-04-14', amount: 2800, type: 'sale', partyId: 4, partyName: 'Tech Solutions', paymentStatus: 'paid', paymentMethod: 'card' },
    { id: 10, date: '2026-04-13', amount: 1100, type: 'sale', partyId: 5, partyName: 'Home Center', paymentStatus: 'pending', paymentMethod: 'cash' },
    // Purchases
    { id: 11, date: '2026-04-19', amount: 500, type: 'purchase', partyId: 6, partyName: 'Wholesale Corp', paymentStatus: 'paid', paymentMethod: 'bank' },
    { id: 12, date: '2026-04-19', amount: 750, type: 'purchase', partyId: 7, partyName: 'Global Traders', paymentStatus: 'partial', paymentMethod: 'card' },
    { id: 13, date: '2026-04-18', amount: 1200, type: 'purchase', partyId: 8, partyName: 'Manufacturing Hub', paymentStatus: 'paid', paymentMethod: 'bank' },
    { id: 14, date: '2026-04-17', amount: 300, type: 'purchase', partyId: 6, partyName: 'Wholesale Corp', paymentStatus: 'paid', paymentMethod: 'cash' },
    { id: 15, date: '2026-04-16', amount: 950, type: 'purchase', partyId: 9, partyName: 'Import Export Co', paymentStatus: 'pending', paymentMethod: 'bank' },
    { id: 16, date: '2026-04-15', amount: 2100, type: 'purchase', partyId: 7, partyName: 'Global Traders', paymentStatus: 'paid', paymentMethod: 'card' },
    { id: 17, date: '2026-04-14', amount: 650, type: 'purchase', partyId: 8, partyName: 'Manufacturing Hub', paymentStatus: 'paid', paymentMethod: 'bank' },
    { id: 18, date: '2026-04-13', amount: 1800, type: 'purchase', partyId: 9, partyName: 'Import Export Co', paymentStatus: 'partial', paymentMethod: 'cash' }
  ];

  private parties: Party[] = [
    // Customers
    { id: 1, name: 'John Electronics', type: 'customer', dueAmount: 3250, totalSales: 12500, phone: '+1 (555) 123-4567', email: 'john@electronics.com', address: '123 Main St', creditLimit: 5000, lastTransaction: '2026-04-19' },
    { id: 2, name: 'Sarah Stores', type: 'customer', dueAmount: 1890, totalSales: 8750, phone: '+1 (555) 234-5678', email: 'sarah@stores.com', address: '456 Oak Ave', creditLimit: 3000, lastTransaction: '2026-04-19' },
    { id: 3, name: 'Mike Retail', type: 'customer', dueAmount: 5420, totalSales: 15200, phone: '+1 (555) 345-6789', email: 'mike@retail.com', address: '789 Pine Rd', creditLimit: 8000, lastTransaction: '2026-04-19' },
    { id: 4, name: 'Tech Solutions', type: 'customer', dueAmount: 8760, totalSales: 23400, phone: '+1 (555) 456-7890', email: 'tech@solutions.com', address: '321 Elm St', creditLimit: 10000, lastTransaction: '2026-04-18' },
    { id: 5, name: 'Home Center', type: 'customer', dueAmount: 2340, totalSales: 5600, phone: '+1 (555) 567-8901', email: 'home@center.com', address: '654 Maple Dr', creditLimit: 4000, lastTransaction: '2026-04-18' },
    { id: 10, name: 'City Mart', type: 'customer', dueAmount: 6780, totalSales: 18900, phone: '+1 (555) 678-9012', email: 'city@mart.com', address: '987 Cedar Ln', creditLimit: 7000, lastTransaction: '2026-04-17' },
    { id: 11, name: 'Metro Store', type: 'customer', dueAmount: 1250, totalSales: 4200, phone: '+1 (555) 789-0123', email: 'metro@store.com', address: '147 Birch Way', creditLimit: 2000, lastTransaction: '2026-04-16' },
    { id: 12, name: 'Prime Retail', type: 'customer', dueAmount: 4450, totalSales: 11200, phone: '+1 (555) 890-1234', email: 'prime@retail.com', address: '258 Spruce Ct', creditLimit: 6000, lastTransaction: '2026-04-15' },
    { id: 13, name: 'Value Shop', type: 'customer', dueAmount: 3190, totalSales: 8900, phone: '+1 (555) 901-2345', email: 'value@shop.com', address: '369 Ash Blvd', creditLimit: 4000, lastTransaction: '2026-04-14' },
    { id: 14, name: 'Elite Stores', type: 'customer', dueAmount: 9800, totalSales: 25600, phone: '+1 (555) 012-3456', email: 'elite@stores.com', address: '741 Willow St', creditLimit: 12000, lastTransaction: '2026-04-13' },
    // Suppliers
    { id: 6, name: 'Wholesale Corp', type: 'supplier', dueAmount: 1500, totalPurchases: 8900, phone: '+1 (555) 111-2222', email: 'sales@wholesale.com', address: '111 Trade Center' },
    { id: 7, name: 'Global Traders', type: 'supplier', dueAmount: 2800, totalPurchases: 12400, phone: '+1 (555) 222-3333', email: 'info@global.com', address: '222 Commerce Blvd' },
    { id: 8, name: 'Manufacturing Hub', type: 'supplier', dueAmount: 4500, totalPurchases: 18700, phone: '+1 (555) 333-4444', email: 'contact@mfg.com', address: '333 Industry Way' },
    { id: 9, name: 'Import Export Co', type: 'supplier', dueAmount: 1200, totalPurchases: 5600, phone: '+1 (555) 444-5555', email: 'trade@import.com', address: '444 Logistics Dr' },
    { id: 15, name: 'Raw Materials Ltd', type: 'supplier', dueAmount: 6200, totalPurchases: 22100, phone: '+1 (555) 555-6666', email: 'materials@raw.com', address: '555 Supply St' },
    { id: 16, name: 'Packaging Pro', type: 'supplier', dueAmount: 800, totalPurchases: 3400, phone: '+1 (555) 666-7777', email: 'pack@pro.com', address: '666 Pack Ln' },
    { id: 17, name: 'Electronic Parts Co', type: 'supplier', dueAmount: 3400, totalPurchases: 14500, phone: '+1 (555) 777-8888', email: 'parts@elec.com', address: '777 Circuit Ave' },
    { id: 18, name: 'Furniture Suppliers', type: 'supplier', dueAmount: 5100, totalPurchases: 19800, phone: '+1 (555) 888-9999', email: 'furniture@supply.com', address: '888 Wood St' },
    { id: 19, name: 'Textile Importers', type: 'supplier', dueAmount: 1950, totalPurchases: 7200, phone: '+1 (555) 999-0000', email: 'textile@import.com', address: '999 Fabric Rd' },
    { id: 20, name: 'Tools & Equipment', type: 'supplier', dueAmount: 7300, totalPurchases: 26700, phone: '+1 (555) 000-1111', email: 'tools@equip.com', address: '000 Tool Dr' }
  ];

  private products: Product[] = [
    { id: 1, name: 'Wireless Mouse', category: 'Electronics', stock: 5, reorderLevel: 10, purchasePrice: 15, sellingPrice: 29, location: 'Aisle 1' },
    { id: 2, name: 'Mechanical Keyboard', category: 'Electronics', stock: 3, reorderLevel: 8, purchasePrice: 45, sellingPrice: 89, location: 'Aisle 1' },
    { id: 3, name: 'USB-C Cable (2m)', category: 'Accessories', stock: 25, reorderLevel: 15, purchasePrice: 5, sellingPrice: 12, location: 'Aisle 2' },
    { id: 4, name: 'Laptop Stand', category: 'Furniture', stock: 8, reorderLevel: 12, purchasePrice: 25, sellingPrice: 49, location: 'Aisle 3' },
    { id: 5, name: 'Webcam HD', category: 'Electronics', stock: 2, reorderLevel: 5, purchasePrice: 35, sellingPrice: 69, location: 'Aisle 1' },
    { id: 6, name: 'Desk Lamp', category: 'Lighting', stock: 15, reorderLevel: 10, purchasePrice: 18, sellingPrice: 39, location: 'Aisle 4' },
    { id: 7, name: 'Monitor 24"', category: 'Electronics', stock: 4, reorderLevel: 6, purchasePrice: 120, sellingPrice: 199, location: 'Aisle 1' },
    { id: 8, name: 'External SSD 1TB', category: 'Storage', stock: 6, reorderLevel: 8, purchasePrice: 85, sellingPrice: 149, location: 'Aisle 1' }
  ];

  // Date filter properties
  todayDate: string = new Date().toISOString().split('T')[0];
  startDate: string = this.todayDate;
  endDate: string = this.todayDate;

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

  get totalSuppliers(): number {
    return this.parties.filter(p => p.type === 'supplier').length;
  }

  get totalCustomerDue(): number {
    return this.customers.reduce((sum, customer) => sum + customer.dueAmount, 0);
  }

  get totalSupplierDebt(): number {
    return this.parties.filter(p => p.type === 'supplier').reduce((sum, p) => sum + p.dueAmount, 0);
  }

  get totalProducts(): number {
    return this.products.length;
  }

  get inventoryValue(): number {
    return this.products.reduce((sum, p) => sum + (p.stock * p.purchasePrice), 0);
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

  get lowStockProducts(): Product[] {
    return this.products
      .filter(p => p.stock < p.reorderLevel)
      .sort((a, b) => a.stock - b.stock);
  }

  get topProductsByValue(): Product[] {
    return this.products
      .sort((a, b) => (b.stock * b.purchasePrice) - (a.stock * a.purchasePrice))
      .slice(0, 5);
  }

  get recentTransactions(): Transaction[] {
    return this.transactions
      .sort((a, b) => b.date.localeCompare(a.date))
      .slice(0, 10);
  }

  get filteredTopProducts(): Product[] {
    const q = this.topProductsSearch.toLowerCase().trim();
    return this.topProductsByValue.filter(p =>
      !q || p.name.toLowerCase().includes(q) || p.category.toLowerCase().includes(q)
    );
  }


  get dailyPerformance(): DailyStats[] {
    const last7Days = [];
    const today = new Date();
    
    for (let i = 6; i >= 0; i--) {
      const date = new Date(today);
      date.setDate(today.getDate() - i);
      const dateStr = date.toISOString().split('T')[0];
      
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
    this.loadPurchaseSummary();
    this.loadSalesSummary();
  }

  resetDateFilter() {
    this.startDate = this.todayDate;
    this.endDate = this.todayDate;
    this.loadPurchaseSummary();
    this.loadSalesSummary();
  }

  quickFilter(event: Event) {
    const value = (event.target as HTMLSelectElement).value;
    const today = new Date();
    const todayStr = today.toISOString().split('T')[0];
    
    switch(value) {
      case 'today':
        this.startDate = todayStr;
        this.endDate = todayStr;
        break;
      case 'yesterday':
        const yesterday = new Date(today);
        yesterday.setDate(today.getDate() - 1);
        const yesterdayStr = yesterday.toISOString().split('T')[0];
        this.startDate = yesterdayStr;
        this.endDate = yesterdayStr;
        break;
      case 'week':
        const weekStart = new Date(today);
        weekStart.setDate(today.getDate() - today.getDay());
        this.startDate = weekStart.toISOString().split('T')[0];
        this.endDate = todayStr;
        break;
      case 'month':
        const monthStart = new Date(today.getFullYear(), today.getMonth(), 1);
        this.startDate = monthStart.toISOString().split('T')[0];
        this.endDate = todayStr;
        break;
      case 'quarter':
        const quarterStart = new Date(today.getFullYear(), Math.floor(today.getMonth() / 3) * 3, 1);
        this.startDate = quarterStart.toISOString().split('T')[0];
        this.endDate = todayStr;
        break;
      default:
        return;
    }
    this.filterByDate();
  }
}