import { Component } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { CustomerService } from '../../services/customer.service';

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
    <div class="space-y-6 p-6 bg-gradient-to-br from-gray-50 to-gray-100 min-h-screen">
      
      <!-- Header with Quick Actions -->
      <div class="bg-white rounded-2xl shadow-lg p-6">
        <div class="flex flex-wrap justify-between items-center">
          <div>
            <h1 class="text-3xl font-bold bg-gradient-to-r from-indigo-600 to-purple-600 bg-clip-text text-transparent">
              Shop Management Dashboard
            </h1>
            <p class="text-gray-500 mt-1">Real-time business intelligence & analytics</p>
          </div>
          <div class="flex gap-3">
            <button class="px-4 py-2 bg-green-500 text-white rounded-lg hover:bg-green-600 transition flex items-center gap-2">
              <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 4v16m8-8H4"></path>
              </svg>
              New Sale
            </button>
            <button class="px-4 py-2 bg-blue-500 text-white rounded-lg hover:bg-blue-600 transition flex items-center gap-2">
              <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 4v16m8-8H4"></path>
              </svg>
              New Purchase
            </button>
          </div>
        </div>
      </div>

      <!-- Enhanced Date Filter -->
      <div class="bg-white rounded-2xl shadow-lg p-5">
        <div class="flex flex-wrap gap-4 items-end justify-between">
          <div class="flex gap-4 flex-wrap">
            <div>
              <label class="text-sm font-medium text-gray-700 block mb-1">Start Date</label>
              <input 
                type="date" 
                [(ngModel)]="startDate" 
                (change)="filterByDate()"
                class="border border-gray-300 rounded-lg px-4 py-2 focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500"
              >
            </div>
            <div>
              <label class="text-sm font-medium text-gray-700 block mb-1">End Date</label>
              <input 
                type="date" 
                [(ngModel)]="endDate" 
                (change)="filterByDate()"
                class="border border-gray-300 rounded-lg px-4 py-2 focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500"
              >
            </div>
            <div>
              <label class="text-sm font-medium text-gray-700 block mb-1">Quick Filters</label>
              <select 
                (change)="quickFilter($event)"
                class="border border-gray-300 rounded-lg px-4 py-2 focus:ring-2 focus:ring-indigo-500"
              >
                <option value="">Custom Range</option>
                <option value="today">Today</option>
                <option value="yesterday">Yesterday</option>
                <option value="week">This Week</option>
                <option value="month">This Month</option>
                <option value="quarter">This Quarter</option>
              </select>
            </div>
          </div>
          <button 
            (click)="resetDateFilter()"
            class="px-4 py-2 text-sm bg-gray-200 text-gray-700 rounded-lg hover:bg-gray-300 transition"
          >
            Reset Filters
          </button>
        </div>
      </div>

      <!-- Key Metrics Cards with Trends -->
      <div class="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
        <!-- Sales Card -->
        <div class="bg-white rounded-2xl shadow-lg p-6 hover:shadow-xl transition group">
          <div class="flex justify-between items-start">
            <div>
              <p class="text-sm text-gray-500 font-medium">Total Sales</p>
              <p class="text-3xl font-bold text-gray-800 mt-1">{{ filteredStats.sales | currency:'USD':'symbol':'1.2-2' }}</p>
              <div class="flex items-center gap-2 mt-2">
                <span class="text-xs px-2 py-1 rounded-full" [class.bg-green-100]="salesGrowth >= 0" [class.bg-red-100]="salesGrowth < 0">
                  <span [class.text-green-600]="salesGrowth >= 0" [class.text-red-600]="salesGrowth < 0">
                    {{ salesGrowth >= 0 ? '+' : '' }}{{ salesGrowth }}%
                  </span>
                </span>
                <span class="text-xs text-gray-500">vs last period</span>
              </div>
            </div>
            <div class="w-12 h-12 bg-gradient-to-br from-green-400 to-green-600 rounded-xl flex items-center justify-center shadow-lg group-hover:scale-110 transition">
              <svg class="w-6 h-6 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 8c-1.657 0-3 .895-3 2s1.343 2 3 2 3 .895 3 2-1.343 2-3 2m0-8c1.11 0 2.08.402 2.599 1M12 8V7m0 1v8m0 0v1m0-1c-1.11 0-2.08-.402-2.599-1M21 12a9 9 0 11-18 0 9 9 0 0118 0z"></path>
              </svg>
            </div>
          </div>
          <div class="mt-3 pt-3 border-t border-gray-100">
            <p class="text-xs text-gray-400">Today: {{ todayStats.sales | currency:'USD':'symbol':'1.2-2' }}</p>
          </div>
        </div>

        <!-- Purchases Card -->
        <div class="bg-white rounded-2xl shadow-lg p-6 hover:shadow-xl transition group">
          <div class="flex justify-between items-start">
            <div>
              <p class="text-sm text-gray-500 font-medium">Total Purchases</p>
              <p class="text-3xl font-bold text-gray-800 mt-1">{{ filteredStats.purchases | currency:'USD':'symbol':'1.2-2' }}</p>
              <div class="flex items-center gap-2 mt-2">
                <span class="text-xs px-2 py-1 rounded-full" [class.bg-green-100]="purchasesGrowth <= 0" [class.bg-red-100]="purchasesGrowth > 0">
                  <span [class.text-green-600]="purchasesGrowth <= 0" [class.text-red-600]="purchasesGrowth > 0">
                    {{ purchasesGrowth >= 0 ? '+' : '' }}{{ purchasesGrowth }}%
                  </span>
                </span>
                <span class="text-xs text-gray-500">vs last period</span>
              </div>
            </div>
            <div class="w-12 h-12 bg-gradient-to-br from-orange-400 to-orange-600 rounded-xl flex items-center justify-center shadow-lg group-hover:scale-110 transition">
              <svg class="w-6 h-6 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M16 11V7a4 4 0 00-8 0v4M5 9h14l1 12H4L5 9z"></path>
              </svg>
            </div>
          </div>
          <div class="mt-3 pt-3 border-t border-gray-100">
            <p class="text-xs text-gray-400">Today: {{ todayStats.purchases | currency:'USD':'symbol':'1.2-2' }}</p>
          </div>
        </div>

        <!-- Profit Card -->
        <div class="bg-white rounded-2xl shadow-lg p-6 hover:shadow-xl transition group">
          <div class="flex justify-between items-start">
            <div>
              <p class="text-sm text-gray-500 font-medium">Net Profit</p>
              <p class="text-3xl font-bold mt-1" [class.text-green-600]="filteredStats.profit >= 0" [class.text-red-600]="filteredStats.profit < 0">
                {{ filteredStats.profit | currency:'USD':'symbol':'1.2-2' }}
              </p>
              <div class="flex items-center gap-2 mt-2">
                <span class="text-xs px-2 py-1 rounded-full" [class.bg-green-100]="profitMargin >= 0" [class.bg-red-100]="profitMargin < 0">
                  <span [class.text-green-600]="profitMargin >= 0" [class.text-red-600]="profitMargin < 0">
                    Margin: {{ profitMargin }}%
                  </span>
                </span>
              </div>
            </div>
            <div class="w-12 h-12 bg-gradient-to-br from-purple-400 to-purple-600 rounded-xl flex items-center justify-center shadow-lg group-hover:scale-110 transition">
              <svg class="w-6 h-6 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z"></path>
              </svg>
            </div>
          </div>
          <div class="mt-3 pt-3 border-t border-gray-100">
            <p class="text-xs text-gray-400">Today: {{ todayStats.profit | currency:'USD':'symbol':'1.2-2' }}</p>
          </div>
        </div>

        <!-- Transaction Count Card -->
        <div class="bg-white rounded-2xl shadow-lg p-6 hover:shadow-xl transition group">
          <div class="flex justify-between items-start">
            <div>
              <p class="text-sm text-gray-500 font-medium">Transactions</p>
              <p class="text-3xl font-bold text-gray-800 mt-1">{{ totalTransactions }}</p>
              <div class="flex gap-3 mt-2 text-xs">
                <span class="text-green-600">Sales: {{ salesCount }}</span>
                <span class="text-orange-600">Purchases: {{ purchasesCount }}</span>
              </div>
            </div>
            <div class="w-12 h-12 bg-gradient-to-br from-blue-400 to-blue-600 rounded-xl flex items-center justify-center shadow-lg group-hover:scale-110 transition">
              <svg class="w-6 h-6 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2"></path>
              </svg>
            </div>
          </div>
        </div>
      </div>

      <!-- Secondary Metrics Row -->
      <div class="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
        <div class="bg-gradient-to-br from-indigo-500 to-indigo-600 rounded-2xl shadow-lg p-5 text-white">
          <div class="flex justify-between items-center">
            <div>
              <p class="text-sm opacity-90">Total Customers</p>
              <p class="text-3xl font-bold mt-1">{{ totalCustomers }}</p>
              <p class="text-xs opacity-75 mt-1">Active accounts</p>
            </div>
            <div class="w-10 h-10 bg-white/20 rounded-full flex items-center justify-center">
              <svg class="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0zm6 3a2 2 0 11-4 0 2 2 0 014 0zM7 10a2 2 0 11-4 0 2 2 0 014 0z"></path>
              </svg>
            </div>
          </div>
          <div class="mt-3 pt-3 border-t border-white/20">
            <p class="text-xs">Total Due: {{ totalCustomerDue | currency:'USD':'symbol':'1.2-2' }}</p>
          </div>
        </div>

        <div class="bg-gradient-to-br from-purple-500 to-purple-600 rounded-2xl shadow-lg p-5 text-white">
          <div class="flex justify-between items-center">
            <div>
              <p class="text-sm opacity-90">Total Suppliers</p>
              <p class="text-3xl font-bold mt-1">{{ totalSuppliers }}</p>
              <p class="text-xs opacity-75 mt-1">Active vendors</p>
            </div>
            <div class="w-10 h-10 bg-white/20 rounded-full flex items-center justify-center">
              <svg class="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M19 21V5a2 2 0 00-2-2H7a2 2 0 00-2 2v16m14 0h2m-2 0h-5m-9 0H3m2 0h5M9 7h1m-1 4h1m4-4h1m-1 4h1m-5 10v-5a1 1 0 011-1h2a1 1 0 011 1v5m-4 0h4"></path>
              </svg>
            </div>
          </div>
          <div class="mt-3 pt-3 border-t border-white/20">
            <p class="text-xs">Total Debt: {{ totalSupplierDebt | currency:'USD':'symbol':'1.2-2' }}</p>
          </div>
        </div>

        <div class="bg-gradient-to-br from-yellow-500 to-yellow-600 rounded-2xl shadow-lg p-5 text-white">
          <div class="flex justify-between items-center">
            <div>
              <p class="text-sm opacity-90">Inventory Value</p>
              <p class="text-3xl font-bold mt-1">{{ inventoryValue | currency:'USD':'symbol':'1.2-2' }}</p>
              <p class="text-xs opacity-75 mt-1">{{ totalProducts }} products</p>
            </div>
            <div class="w-10 h-10 bg-white/20 rounded-full flex items-center justify-center">
              <svg class="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M20 7l-8-4-8 4m16 0l-8 4m8-4v10l-8 4m0-10L4 7m8 4v10M4 7v10l8 4"></path>
              </svg>
            </div>
          </div>
          <div class="mt-3 pt-3 border-t border-white/20">
            <p class="text-xs">Low Stock Items: {{ lowStockProducts.length }}</p>
          </div>
        </div>

        <div class="bg-gradient-to-br from-pink-500 to-pink-600 rounded-2xl shadow-lg p-5 text-white">
          <div class="flex justify-between items-center">
            <div>
              <p class="text-sm opacity-90">Avg. Transaction</p>
              <p class="text-3xl font-bold mt-1">{{ avgTransactionValue | currency:'USD':'symbol':'1.2-2' }}</p>
              <p class="text-xs opacity-75 mt-1">Per transaction</p>
            </div>
            <div class="w-10 h-10 bg-white/20 rounded-full flex items-center justify-center">
              <svg class="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M13 7h8m0 0v8m0-8l-8 8-4-4-6 6"></path>
              </svg>
            </div>
          </div>
        </div>
      </div>

      <!-- Daily Performance Chart (Simplified) -->
      <div class="bg-white rounded-2xl shadow-lg p-6">
        <div class="flex justify-between items-center mb-4">
          <h3 class="text-lg font-semibold text-gray-800">Daily Performance (Last 7 Days)</h3>
          <div class="flex gap-3">
            <span class="flex items-center gap-1 text-xs">
              <div class="w-3 h-3 bg-green-500 rounded"></div>
              <span>Sales</span>
            </span>
            <span class="flex items-center gap-1 text-xs">
              <div class="w-3 h-3 bg-orange-500 rounded"></div>
              <span>Purchases</span>
            </span>
          </div>
        </div>
        <div class="overflow-x-auto">
          <div class="flex gap-4 min-w-max">
            <div *ngFor="let day of dailyPerformance" class="flex flex-col items-center">
              <div class="text-xs text-gray-500 mb-2">{{ day.date | date:'MMM dd' }}</div>
              <div class="flex gap-1 items-end h-32">
                <div class="w-8 bg-green-400 rounded-t hover:bg-green-500 transition" 
                     [style.height.px]="getBarHeight(day.sales, maxDailyValue)"></div>
                <div class="w-8 bg-orange-400 rounded-t hover:bg-orange-500 transition" 
                     [style.height.px]="getBarHeight(day.purchases, maxDailyValue)"></div>
              </div>
              <div class="text-xs font-semibold mt-2">P: {{ day.profit | currency:'USD':'symbol':'1.0-0' }}</div>
            </div>
          </div>
        </div>
      </div>

      <!-- Top Due Lists with Enhanced Details -->
      <div class="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <!-- Customer Due -->
        <div class="bg-white rounded-2xl shadow-lg overflow-hidden">
          <div class="bg-gradient-to-r from-red-500 to-red-600 px-6 py-4">
            <h3 class="text-lg font-semibold text-white flex items-center gap-2">
              <svg class="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 8c-1.657 0-3 .895-3 2s1.343 2 3 2 3 .895 3 2-1.343 2-3 2m0-8c1.11 0 2.08.402 2.599 1M12 8V7m0 1v8m0 0v1m0-1c-1.11 0-2.08-.402-2.599-1M21 12a9 9 0 11-18 0 9 9 0 0118 0z"></path>
              </svg>
              Top 10 Customers by Due Amount
            </h3>
            <p class="text-xs text-red-100 mt-1">Highest outstanding payments</p>
          </div>
          <div class="overflow-x-auto">
            <table class="w-full">
              <thead class="bg-gray-50">
                <tr>
                  <th class="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">#</th>
                  <th class="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Customer</th>
                  <th class="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase">Due Amount</th>
                  <th class="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase">Total Sales</th>
                  <th class="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Contact</th>
                 </tr>
              </thead>
              <tbody class="divide-y divide-gray-200">
                <tr *ngFor="let customer of topCustomerDue; let i = index" class="hover:bg-gray-50 transition">
                  <td class="px-6 py-3 text-sm font-semibold text-gray-500">#{{ i+1 }}</td>
                  <td class="px-6 py-3">
                    <div class="font-medium text-gray-800">{{ customer.name }}</div>
                    <div class="text-xs text-gray-400">ID: {{ customer.id }}</div>
                  </td>
                  <td class="px-6 py-3 text-right">
                    <span class="text-red-600 font-bold">{{ customer.dueAmount | currency:'USD':'symbol':'1.2-2' }}</span>
                    <div class="text-xs text-gray-400">Limit: {{ customer.creditLimit | currency:'USD':'symbol':'1.0-0' }}</div>
                  </td>
                  <td class="px-6 py-3 text-right text-sm text-gray-600">{{ customer.totalSales | currency:'USD':'symbol':'1.2-2' }}</td>
                  <td class="px-6 py-3 text-sm text-gray-500">{{ customer.phone || '-' }}</td>
                </tr>
              </tbody>
            </table>
          </div>
        </div>

        <!-- Supplier Debt -->
        <div class="bg-white rounded-2xl shadow-lg overflow-hidden">
          <div class="bg-gradient-to-r from-orange-500 to-orange-600 px-6 py-4">
            <h3 class="text-lg font-semibold text-white flex items-center gap-2">
              <svg class="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M17 9V7a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2m2 4h10a2 2 0 002-2v-6a2 2 0 00-2-2H9a2 2 0 00-2 2v6a2 2 0 002 2zm7-5a2 2 0 11-4 0 2 2 0 014 0z"></path>
              </svg>
              Top 10 Suppliers by Debt (Owed to Us)
            </h3>
            <p class="text-xs text-orange-100 mt-1">Suppliers who owe money to the shop</p>
          </div>
          <div class="overflow-x-auto">
            <table class="w-full">
              <thead class="bg-gray-50">
                <tr>
                  <th class="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">#</th>
                  <th class="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Supplier</th>
                  <th class="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase">Debt Amount</th>
                  <th class="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase">Total Purchases</th>
                  <th class="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Contact</th>
                 </tr>
              </thead>
              <tbody class="divide-y divide-gray-200">
                <tr *ngFor="let supplier of topSupplierDebt; let i = index" class="hover:bg-gray-50 transition">
                  <td class="px-6 py-3 text-sm font-semibold text-gray-500">#{{ i+1 }}</td>
                  <td class="px-6 py-3">
                    <div class="font-medium text-gray-800">{{ supplier.name }}</div>
                    <div class="text-xs text-gray-400">ID: {{ supplier.id }}</div>
                  </td>
                  <td class="px-6 py-3 text-right">
                    <span class="text-orange-600 font-bold">{{ supplier.dueAmount | currency:'USD':'symbol':'1.2-2' }}</span>
                  </td>
                  <td class="px-6 py-3 text-right text-sm text-gray-600">{{ supplier.totalPurchases | currency:'USD':'symbol':'1.2-2' }}</td>
                  <td class="px-6 py-3 text-sm text-gray-500">{{ supplier.phone || '-' }}</td>
                </tr>
              </tbody>
            </table>
          </div>
        </div>
      </div>

      <!-- Inventory & Alerts Section -->
      <div class="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <!-- Low Stock Alert -->
        <div class="bg-white rounded-2xl shadow-lg overflow-hidden">
          <div class="bg-gradient-to-r from-yellow-500 to-yellow-600 px-6 py-4">
            <h3 class="text-lg font-semibold text-white flex items-center gap-2">
              <svg class="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z"></path>
              </svg>
              Low Stock Alert (Below Reorder Level)
            </h3>
            <p class="text-xs text-yellow-100 mt-1">Items requiring immediate attention</p>
          </div>
          <div class="overflow-x-auto">
            <table class="w-full">
              <thead class="bg-gray-50">
                <tr>
                  <th class="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Product</th>
                  <th class="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Category</th>
                  <th class="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase">Stock</th>
                  <th class="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase">Reorder Level</th>
                  <th class="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase">Status</th>
                 </tr>
              </thead>
              <tbody class="divide-y divide-gray-200">
                <tr *ngFor="let product of lowStockProducts" class="hover:bg-gray-50 transition">
                  <td class="px-6 py-3">
                    <div class="font-medium text-gray-800">{{ product.name }}</div>
                    <div class="text-xs text-gray-400">{{ product.location || 'Main Store' }}</div>
                  </td>
                  <td class="px-6 py-3 text-sm text-gray-600">{{ product.category }}</td>
                  <td class="px-6 py-3 text-right">
                    <span class="font-bold text-red-600">{{ product.stock }} units</span>
                  </td>
                  <td class="px-6 py-3 text-right text-sm text-gray-600">{{ product.reorderLevel }} units</td>
                  <td class="px-6 py-3 text-right">
                    <span class="inline-flex items-center px-2 py-1 rounded-full text-xs font-medium bg-red-100 text-red-800">
                      Critical
                    </span>
                  </td>
                </tr>
              </tbody>
            </table>
          </div>
        </div>

        <!-- Top Products by Stock Value -->
        <div class="bg-white rounded-2xl shadow-lg overflow-hidden">
          <div class="bg-gradient-to-r from-green-500 to-green-600 px-6 py-4">
            <h3 class="text-lg font-semibold text-white flex items-center gap-2">
              <svg class="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z"></path>
              </svg>
              Top Products by Inventory Value
            </h3>
            <p class="text-xs text-green-100 mt-1">Highest value items in stock</p>
          </div>
          <div class="overflow-x-auto">
            <table class="w-full">
              <thead class="bg-gray-50">
                <tr>
                  <th class="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Product</th>
                  <th class="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase">Stock</th>
                  <th class="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase">Unit Price</th>
                  <th class="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase">Total Value</th>
                 </tr>
              </thead>
              <tbody class="divide-y divide-gray-200">
                <tr *ngFor="let product of topProductsByValue" class="hover:bg-gray-50 transition">
                  <td class="px-6 py-3">
                    <div class="font-medium text-gray-800">{{ product.name }}</div>
                    <div class="text-xs text-gray-400">{{ product.category }}</div>
                  </td>
                  <td class="px-6 py-3 text-right text-sm text-gray-600">{{ product.stock }} units</td>
                  <td class="px-6 py-3 text-right text-sm text-gray-600">৳  {{ product.purchasePrice}}</td>
                  <td class="px-6 py-3 text-right font-semibold text-gray-800">৳  {{ product.stock * product.purchasePrice }}</td>
                </tr>
              </tbody>
            </table>
          </div>
        </div>
      </div>

      <!-- Recent Transactions -->
      <div class="bg-white rounded-2xl shadow-lg overflow-hidden">
        <div class="bg-gradient-to-r from-gray-700 to-gray-800 px-6 py-4">
          <h3 class="text-lg font-semibold text-white flex items-center gap-2">
            <svg class="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2"></path>
            </svg>
            Recent Transactions
          </h3>
          <p class="text-xs text-gray-300 mt-1">Last 10 transactions</p>
        </div>
        <div class="overflow-x-auto">
          <table class="w-full">
            <thead class="bg-gray-50">
              <tr>
                <th class="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Date</th>
                <th class="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Type</th>
                <th class="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Party</th>
                <th class="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase">Amount</th>
                <th class="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Status</th>
              </tr>
            </thead>
            <tbody class="divide-y divide-gray-200">
              <tr *ngFor="let transaction of recentTransactions" class="hover:bg-gray-50 transition">
                <td class="px-6 py-3 text-sm text-gray-600">{{ transaction.date }}</td>
                <td class="px-6 py-3">
                  <span class="inline-flex items-center px-2 py-1 rounded-full text-xs font-medium" 
                        [class.bg-green-100]="transaction.type === 'sale'" 
                        [class.text-green-800]="transaction.type === 'sale'"
                        [class.bg-orange-100]="transaction.type === 'purchase'"
                        [class.text-orange-800]="transaction.type === 'purchase'">
                    {{ transaction.type === 'sale' ? 'Sale' : 'Purchase' }}
                  </span>
                </td>
                <td class="px-6 py-3 text-sm font-medium text-gray-800">{{ transaction.partyName }}</td>
                <td class="px-6 py-3 text-right font-semibold" 
                    [class.text-green-600]="transaction.type === 'sale'" 
                    [class.text-orange-600]="transaction.type === 'purchase'">
                  ৳{{ transaction.amount }}
                </td>
                <td class="px-6 py-3">
                  <span class="inline-flex items-center px-2 py-1 rounded-full text-xs font-medium bg-green-100 text-green-800">
                    Completed
                  </span>
                </td>
              </tr>
            </tbody>
          </table>
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


export class DashboardComponent {
 customers: any[] = [];
  constructor(private customerService: CustomerService) {}

    ngOnInit(): void {
      this.getAllCustomers();
    }

    getAllCustomers(): void {
    this.customerService.getAllCustomers().subscribe({
      next: (response: any) => {
        this.customers = Array.isArray(response) ? response : response.data || [];
        console.log('Customers loaded:', this.customers);
      },
      error: (err: any) => {
        console.error('Error loading customers:', err);
        this.customers = [];
        
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
  startDate: string = '';
  endDate: string = '';
  todayDate: string = new Date().toISOString().split('T')[0];

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
    console.log('Date filter applied:', this.startDate, this.endDate);
  }

  resetDateFilter() {
    this.startDate = '';
    this.endDate = '';
    console.log('Date filter reset');
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