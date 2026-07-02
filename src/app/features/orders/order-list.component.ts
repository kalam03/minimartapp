import { Component, OnInit, ChangeDetectorRef, NgZone } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { Router } from '@angular/router';
import { OrderService, OrderListDto } from '../../services/order.service';

@Component({
  selector: 'app-order-list',
  standalone: true,
  imports: [CommonModule, FormsModule],
  template: `
<div class="px-3 py-2">
  <div class="max-w-8xl mx-auto">

    <!-- Header -->
    <div class="bg-white rounded-xl shadow-md border mb-3 overflow-hidden">
      <div class="px-4 py-3 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3"
           style="background:#1a1c4e">
        <div>
          <h1 class="text-white font-bold text-sm flex items-center gap-2">
            <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2"
                d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2"/>
            </svg>
            Order Management
          </h1>
          <p class="text-xs mt-0.5" style="color:#ACB3E7">Manage and process customer orders</p>
        </div>
        <button (click)="newOrder()"
          class="flex items-center gap-2 px-4 py-2 rounded-lg text-xs font-semibold transition"
          style="background:#ACB3E7;color:#1a1c4e"
          onmouseover="this.style.background='#c8ccee'" onmouseout="this.style.background='#ACB3E7'">
          <svg class="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 4v16m8-8H4"/>
          </svg>
          New Order
        </button>
      </div>

      <!-- Filter bar -->
      <div class="px-4 py-2.5 flex flex-wrap items-center gap-3 border-t" style="border-color:#f0f2fb">

        <!-- Status pills -->
        <div class="flex flex-wrap gap-1.5">
          <button *ngFor="let s of statusOptions"
            (click)="setStatus(s.value)"
            class="px-2.5 py-1 text-xs rounded-full font-medium border transition"
            [style]="filterStatus === s.value
              ? 'background:#1a1c4e;color:#fff;border-color:#1a1c4e'
              : 'background:#f0f2fb;color:#1a1c4e;border-color:#e0e3f8'">
            <span *ngIf="s.value !== ''">
              <span class="inline-block w-1.5 h-1.5 rounded-full mr-1 align-middle"
                    [style]="'background:' + s.color"></span>
            </span>
            {{ s.label }}
          </button>
        </div>

        <!-- Date range + Search -->
        <div class="flex items-center gap-1.5 ml-auto flex-wrap">
          <span class="text-xs text-gray-400">From</span>
          <input type="date" [(ngModel)]="fromDate"
            class="text-xs border rounded-md px-2 py-1 outline-none"
            style="border-color:#d1d5f0;min-width:115px"
            onfocus="this.style.borderColor='#1a1c4e'" onblur="this.style.borderColor='#d1d5f0'"/>
          <span class="text-xs text-gray-400">To</span>
          <input type="date" [(ngModel)]="toDate"
            class="text-xs border rounded-md px-2 py-1 outline-none"
            style="border-color:#d1d5f0;min-width:115px"
            onfocus="this.style.borderColor='#1a1c4e'" onblur="this.style.borderColor='#d1d5f0'"/>

          <!-- Search button -->
          <button (click)="load()"
            class="flex items-center gap-1.5 px-3 py-1 text-xs rounded-md font-semibold text-white transition"
            style="background:#1a1c4e"
            onmouseover="this.style.background='#252862'" onmouseout="this.style.background='#1a1c4e'">
            <svg class="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2"
                d="M21 21l-4.35-4.35M17 11A6 6 0 105 11a6 6 0 0012 0z"/>
            </svg>
            Search
          </button>

          <button (click)="resetFilters()"
            class="px-2 py-1 text-xs rounded-md border flex items-center gap-1"
            style="color:#6b7280;border-color:#e5e7eb"
            onmouseover="this.style.background='#f3f4f6'" onmouseout="this.style.background='transparent'">
            <svg class="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2"
                d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15"/>
            </svg>
            Reset
          </button>
        </div>
      </div>
    </div>

    <!-- Loading -->
    <div *ngIf="loading" class="flex items-center justify-center py-16">
      <div class="animate-spin rounded-full h-8 w-8 border-4 border-indigo-200 border-t-indigo-600"></div>
      <span class="ml-3 text-sm text-gray-500">Loading orders…</span>
    </div>

    <!-- Idle (not yet searched) -->
    <div *ngIf="!loading && !loaded"
         class="bg-white rounded-xl border shadow-sm p-12 text-center text-gray-400">
      <svg class="w-12 h-12 mx-auto mb-3 opacity-30" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path stroke-linecap="round" stroke-linejoin="round" stroke-width="1.5"
          d="M21 21l-4.35-4.35M17 11A6 6 0 105 11a6 6 0 0012 0z"/>
      </svg>
      <p class="text-sm font-medium text-gray-500">Select date range and click Search</p>
      <p class="text-xs text-gray-400 mt-1">Orders will appear here after searching.</p>
    </div>

    <!-- Empty (searched but no results) -->
    <div *ngIf="!loading && loaded && filteredOrders.length === 0"
         class="bg-white rounded-xl border shadow-sm p-12 text-center text-gray-400">
      <svg class="w-12 h-12 mx-auto mb-3 opacity-30" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path stroke-linecap="round" stroke-linejoin="round" stroke-width="1.5"
          d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2"/>
      </svg>
      <p class="text-sm">No orders found for the selected filters.</p>
      <button (click)="newOrder()"
        class="mt-4 px-4 py-2 text-xs rounded-lg font-semibold text-white"
        style="background:#1a1c4e">
        + Create First Order
      </button>
    </div>

    <!-- Orders Table -->
    <div *ngIf="!loading && loaded && filteredOrders.length > 0"
         class="bg-white rounded-xl shadow-md border overflow-hidden">
      <div class="overflow-x-auto">
        <table class="w-full text-xs">
          <thead>
            <tr style="background:#e0e3f8;color:#1a1c4e">
              <th class="px-3 py-2 text-left font-semibold w-20">#Order</th>
              <th class="px-3 py-2 text-left font-semibold">Customer</th>
              <th class="px-3 py-2 text-center font-semibold w-24">Date</th>
              <th class="px-3 py-2 text-center font-semibold w-16">Items</th>
              <th class="px-3 py-2 text-right font-semibold w-28">Amount</th>
              <th class="px-3 py-2 text-center font-semibold w-24">Status</th>
              <th class="px-3 py-2 text-center font-semibold w-28">Action</th>
            </tr>
          </thead>
          <tbody>
            <tr *ngFor="let o of filteredOrders; let i = index"
                [class]="i % 2 === 0 ? 'bg-white hover:bg-indigo-50' : 'bg-gray-50 hover:bg-indigo-50'"
                class="border-b transition-colors">

              <!-- Order # -->
              <td class="px-3 py-2">
                <span class="font-mono font-semibold" style="color:#1a1c4e">#{{ o.orderId }}</span>
                <div class="text-gray-400 text-xs">{{ o.createdBy }}</div>
              </td>

              <!-- Customer -->
              <td class="px-3 py-2">
                <div class="font-medium text-gray-800">{{ o.customerName || 'Walk-in' }}</div>
                <div class="text-gray-400 flex items-center gap-1" *ngIf="o.customerPhone">
                  <svg class="w-3 h-3 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2"
                      d="M3 5a2 2 0 012-2h3.28a1 1 0 01.948.684l1.498 4.493a1 1 0 01-.502 1.21l-2.257 1.13a11.042 11.042 0 005.516 5.516l1.13-2.257a1 1 0 011.21-.502l4.493 1.498a1 1 0 01.684.949V19a2 2 0 01-2 2h-1C9.716 21 3 14.284 3 6V5z"/>
                  </svg>
                  {{ o.customerPhone }}
                </div>
                <div class="text-gray-400 italic" *ngIf="o.notes" [title]="o.notes">
                  {{ o.notes | slice:0:30 }}{{ (o.notes?.length ?? 0) > 30 ? '…' : '' }}
                </div>
              </td>

              <!-- Date -->
              <td class="px-3 py-2 text-center text-gray-600">
                {{ o.orderDate | date:'dd MMM yy' }}
                <div class="text-gray-400">{{ o.createdAt | date:'HH:mm' }}</div>
              </td>

              <!-- Items count -->
              <td class="px-3 py-2 text-center">
                <span class="px-2 py-0.5 rounded-full text-xs font-semibold"
                      style="background:#e0e3f8;color:#1a1c4e">
                  {{ o.itemCount }}
                </span>
              </td>

              <!-- Amount -->
              <td class="px-3 py-2 text-right">
                <div class="font-bold" style="color:#1a1c4e">&#2547;{{ o.grossAmount | number:'1.2-2' }}</div>
                <div class="text-gray-400" *ngIf="o.discount > 0">-&#2547;{{ o.discount | number:'1.2-2' }}</div>
              </td>

              <!-- Status badge -->
              <td class="px-3 py-2 text-center">
                <span class="px-2 py-0.5 rounded-full text-xs font-semibold"
                      [style]="statusStyle(o.status)">
                  {{ o.status }}
                </span>
              </td>

              <!-- Action -->
              <td class="px-3 py-2 text-center">
                <button *ngIf="o.status === 'New' || o.status === 'Processing'"
                  (click)="openInCounter(o)"
                  class="px-3 py-1 rounded-lg text-xs font-semibold text-white transition"
                  style="background:#1a1c4e"
                  onmouseover="this.style.background='#252862'"
                  onmouseout="this.style.background='#1a1c4e'">
                  Open in Counter
                </button>
                <span *ngIf="o.status === 'Completed'"
                  class="inline-flex items-center gap-1 text-green-600 font-semibold">
                  <svg class="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2.5" d="M5 13l4 4L19 7"/>
                  </svg>
                  Done
                </span>
                <span *ngIf="o.status === 'Cancelled'"
                  class="text-gray-400">Cancelled</span>
              </td>
            </tr>
          </tbody>
        </table>
      </div>

      <!-- Footer count -->
      <div class="px-4 py-2 text-xs text-gray-400 border-t" style="border-color:#f0f2fb">
        Showing {{ filteredOrders.length }} of {{ allOrders.length }} orders
      </div>
    </div>

  </div>
</div>
  `
})
export class OrderListComponent implements OnInit {

  allOrders:      OrderListDto[] = [];
  filteredOrders: OrderListDto[] = [];
  loading = false;
  loaded  = false;   // true only after first successful search

  filterStatus = '';
  fromDate     = '';
  toDate       = '';

  statusOptions = [
    { value: '',            label: 'All',        color: '#6b7280' },
    { value: 'New',         label: 'New',        color: '#3b82f6' },
    { value: 'Processing',  label: 'Processing', color: '#f59e0b' },
    { value: 'Completed',   label: 'Completed',  color: '#10b981' },
    { value: 'Cancelled',   label: 'Cancelled',  color: '#ef4444' },
  ];

  constructor(
    private orderSvc: OrderService,
    private router:   Router,
    private cdr:      ChangeDetectorRef,
    private zone:     NgZone
  ) {}

  ngOnInit(): void {
    const today = new Date().toISOString().split('T')[0];
    this.fromDate    = today;
    this.toDate      = today;
    this.filterStatus = 'New';   // default: show only New orders
    this.load();
  }

  load(): void {
    this.loading = true;
    this.cdr.detectChanges();
    this.orderSvc.getOrders(this.filterStatus || undefined, this.fromDate, this.toDate).subscribe({
      next: res => {
        this.zone.run(() => {
          this.allOrders = res?.data ?? [];
          this.applyStatusFilter();
          this.loading = false;
          this.loaded  = true;
          this.cdr.detectChanges();
        });
      },
      error: () => {
        this.zone.run(() => {
          this.loading = false;
          this.loaded  = true;
          this.cdr.detectChanges();
        });
      }
    });
  }

  setStatus(status: string): void {
    this.filterStatus = status;
    this.load();   // re-fetch from server with new status filter
  }

  applyStatusFilter(): void {
    // allOrders already server-filtered; just copy to filteredOrders
    this.filteredOrders = [...this.allOrders];
  }

  countByStatus(_status: string): number {
    // counts not meaningful when server-filtered — hide from pills
    return this.allOrders.length;
  }

  resetFilters(): void {
    const today = new Date().toISOString().split('T')[0];
    this.fromDate     = today;
    this.toDate       = today;
    this.filterStatus = '';
    this.load();
  }

  newOrder(): void {
    this.router.navigate(['/orders/new']);
  }

  openInCounter(order: OrderListDto): void {
    this.router.navigate(['/pos'], { queryParams: { orderId: order.orderId } });
  }

  statusStyle(status: string): string {
    const map: Record<string, string> = {
      'New':        'background:#dbeafe;color:#1d4ed8',
      'Processing': 'background:#fef3c7;color:#b45309',
      'Completed':  'background:#d1fae5;color:#065f46',
      'Cancelled':  'background:#fee2e2;color:#b91c1c',
    };
    return map[status] ?? 'background:#f3f4f6;color:#374151';
  }
}
