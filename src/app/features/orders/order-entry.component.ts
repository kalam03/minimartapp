import { Component, OnInit, HostListener, ViewChild, ElementRef } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { Router } from '@angular/router';
import { ProductService } from '../../services/product.service';
import { Product, ProductFilter } from '../../models/product';
import { AlertService } from '../../shared/alert.service';
import { OrderService, CreateOrderRequest } from '../../services/order.service';
import { CustomerService, Customer } from '../../services/customer.service';

interface OrderCartItem {
  productId:  number;
  product:    Product;
  quantity:   number;
  unitPrice:  number;
  subtotal:   number;
}

@Component({
  selector: 'app-order-entry',
  standalone: true,
  imports: [CommonModule, FormsModule],
  template: `
<div class="px-3 py-2">
  <div class="max-w-8xl mx-auto">

    <!-- Header -->
    <div class="rounded-xl overflow-hidden border mb-3 shadow-md" style="background:var(--theme-primary)">
      <div class="px-4 py-3 flex items-center justify-between">
        <div class="flex items-center gap-3">
          <button (click)="goBack()"
            class="p-1.5 rounded-lg transition" style="color:var(--theme-accent)"
            onmouseover="this.style.background='rgba(255,255,255,0.1)'"
            onmouseout="this.style.background='transparent'">
            <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M15 19l-7-7 7-7"/>
            </svg>
          </button>
          <div>
            <h1 class="text-white font-bold text-sm flex items-center gap-2">
              <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2"
                  d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2"/>
              </svg>
              New Order
            </h1>
            <p class="text-xs" style="color:var(--theme-accent)">Add products and save as a pending order</p>
          </div>
        </div>
        <div class="text-xs" style="color:var(--theme-accent)">{{ today | date:'dd MMM yyyy' }}</div>
      </div>
    </div>

    <!-- Main Grid -->
    <div class="grid grid-cols-1 lg:grid-cols-2 gap-3">

      <!-- LEFT: Product Selection -->
      <div class="bg-white rounded-xl shadow-md border overflow-hidden">
        <div class="px-3 py-2" style="background:var(--theme-primary)">
          <h2 class="text-white font-semibold text-sm flex items-center gap-2">
            <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2"
                d="M20 7L4 7M20 12L4 12M20 17L4 17M8 3v4m8-4v4"/>
            </svg>
            Select Product
          </h2>
        </div>
        <div class="p-3">

          <!-- Product Search -->
          <div class="product-search-wrap relative mb-3">
            <input #productSearchInput type="text"
              [ngModel]="searchTerm" (ngModelChange)="onSearch($event)"
              (keydown)="onKeydown($event)"
              placeholder="Search product by name or barcode…"
              class="w-full pl-8 pr-3 py-2 text-sm border rounded-lg outline-none"
              style="border-color:#d1d5f0"
              onfocus="this.style.borderColor='var(--theme-primary)'" onblur="this.style.borderColor='#d1d5f0'"/>
            <svg class="absolute left-2.5 top-2.5 w-3.5 h-3.5 text-gray-400"
              fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2"
                d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z"/>
            </svg>

            <!-- Product Dropdown -->
            <div *ngIf="showDropdown && filteredProducts.length > 0"
              class="absolute z-20 w-full mt-1 bg-white border rounded-lg shadow-xl max-h-52 overflow-y-auto"
              style="border-color:#d1d5f0">
              <div *ngFor="let p of filteredProducts; let i = index"
                (click)="selectProduct(p)"
                class="px-3 py-2 cursor-pointer flex items-center justify-between text-xs transition"
                [style]="i === selectedIdx
                  ? 'background:var(--theme-primary);color:var(--theme-text)'
                  : 'color:#374151'"
                onmouseover="this.style.background='#f0f2fb'"
                onmouseout="">
                <div>
                  <div class="font-semibold">{{ p.productName }}</div>
                  <div class="opacity-60">{{ p.categoryName }} · {{ p.unitType || 'PCS' }}</div>
                </div>
                <div class="text-right">
                  <div class="font-semibold">&#2547;{{ p.salePrice | number:'1.2-2' }}</div>
                  <div [style]="p.stockQty <= 0 ? 'color:#ef4444' : 'color:#10b981'">
                    Stock: {{ p.stockQty }}
                  </div>
                </div>
              </div>
            </div>
          </div>

          <!-- Selected product controls -->
          <div *ngIf="selectedProduct" class="rounded-lg p-3 mb-3" style="background:#f0f2fb;border:1px solid var(--theme-text)">
            <div class="flex items-start justify-between mb-2">
              <div>
                <p class="font-semibold text-sm" style="color:var(--theme-primary)">{{ selectedProduct.productName }}</p>
                <p class="text-xs text-gray-500">{{ selectedProduct.categoryName }} · {{ selectedProduct.unitType || 'PCS' }}</p>
              </div>
              <span class="text-xs px-2 py-0.5 rounded-full font-semibold"
                    [style]="selectedProduct.stockQty <= 0
                      ? 'background:#fee2e2;color:#b91c1c'
                      : 'background:#d1fae5;color:#065f46'">
                Stock: {{ selectedProduct.stockQty }}
              </span>
            </div>
            <div class="grid grid-cols-3 gap-2">
              <div>
                <label class="block text-xs text-gray-500 mb-1">Qty ({{ selectedProduct.unitType || 'PCS' }})</label>
                <input type="number" #quantityInput
                  [(ngModel)]="qty"
                  [min]="isWeight ? 0.001 : 1"
                  [step]="isWeight ? '0.001' : '1'"
                  (keydown.enter)="addToCart()"
                  (keydown.tab)="$event.preventDefault(); addToCart()"
                  class="w-full px-2 py-1.5 text-sm border rounded outline-none"
                  style="border-color:#d1d5f0"/>
              </div>
              <div>
                <label class="block text-xs text-gray-500 mb-1">Unit Price</label>
                <input type="number" [(ngModel)]="unitPrice" min="0"
                  class="w-full px-2 py-1.5 text-sm border rounded outline-none"
                  style="border-color:#d1d5f0"/>
              </div>
              <div class="flex items-end">
                <button (click)="addToCart()"
                  class="w-full py-1.5 rounded-lg text-xs font-semibold text-white transition"
                  style="background:var(--theme-primary)"
                  onmouseover="this.style.background='var(--theme-primary-light)'"
                  onmouseout="this.style.background='var(--theme-primary)'">
                  + Add
                </button>
              </div>
            </div>
          </div>

          <div *ngIf="!selectedProduct" class="text-center text-gray-400 py-6 text-xs">
            Search and select a product to add it to the order
          </div>
        </div>
      </div>

      <!-- RIGHT: Cart + Customer + Save -->
      <div class="flex flex-col gap-3">

        <!-- Cart -->
        <div class="bg-white rounded-xl shadow-md border overflow-hidden flex-1">
          <div class="px-3 py-2 flex items-center justify-between" style="background:var(--theme-primary)">
            <h2 class="text-white font-semibold text-sm flex items-center gap-2">
              <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2"
                  d="M3 3h2l.4 2M7 13h10l4-8H5.4M7 13L5.4 5M7 13l-2.293 2.293c-.63.63-.184 1.707.707 1.707H17m0 0a2 2 0 100 4 2 2 0 000-4zm-8 2a2 2 0 11-4 0 2 2 0 014 0z"/>
              </svg>
              Cart ({{ cartItems.length }})
            </h2>
            <button *ngIf="cartItems.length > 0" (click)="clearCart()"
              class="text-xs px-2 py-0.5 rounded font-medium transition"
              style="color:var(--theme-accent)"
              onmouseover="this.style.color='#ef4444'" onmouseout="this.style.color='var(--theme-accent)'">
              Clear All
            </button>
          </div>

          <div *ngIf="cartItems.length === 0" class="p-8 text-center text-gray-400 text-xs">
            <svg class="w-8 h-8 mx-auto mb-2 opacity-30" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path stroke-linecap="round" stroke-linejoin="round" stroke-width="1.5"
                d="M3 3h2l.4 2M7 13h10l4-8H5.4M7 13L5.4 5M7 13l-2.293 2.293c-.63.63-.184 1.707.707 1.707H17"/>
            </svg>
            No items yet. Search and add products.
          </div>

          <div *ngIf="cartItems.length > 0" class="overflow-x-auto">
            <table class="w-full text-xs">
              <thead>
                <tr style="background:var(--theme-text);color:var(--theme-primary)">
                  <th class="px-3 py-1.5 text-left">Product</th>
                  <th class="px-2 py-1.5 text-center w-20">Qty</th>
                  <th class="px-2 py-1.5 text-right w-24">Price</th>
                  <th class="px-2 py-1.5 text-right w-24">Total</th>
                  <th class="px-2 py-1.5 w-8"></th>
                </tr>
              </thead>
              <tbody>
                <tr *ngFor="let item of cartItems; let i = index"
                    [class]="i%2===0 ? 'bg-white' : 'bg-gray-50'" class="border-b">
                  <td class="px-3 py-1.5">
                    <div class="font-medium text-gray-800">{{ item.product.productName }}</div>
                    <div class="text-gray-400 flex items-center gap-1.5">
                      <span>{{ item.product.unitType || 'PCS' }}</span>
                      <span class="text-gray-300">|</span>
                      <span [style]="item.product.stockQty <= 0 ? 'color:#ef4444' : 'color:#6b7280'">
                        Stock: {{ item.product.stockQty }}
                      </span>
                    </div>
                    <!-- Exceed-stock warning -->
                    <div *ngIf="item.quantity > item.product.stockQty"
                         class="flex items-center gap-1 mt-0.5 text-xs font-semibold text-red-600">
                      <svg class="w-3 h-3 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2"
                          d="M12 9v2m0 4h.01M10.29 3.86L1.82 18a2 2 0 001.71 3h16.94a2 2 0 001.71-3L13.71 3.86a2 2 0 00-3.42 0z"/>
                      </svg>
                      Exceeds stock ({{ item.product.stockQty }} available)
                    </div>
                  </td>
                  <td class="px-2 py-1.5 text-center">
                    <input type="number" [(ngModel)]="item.quantity"
                      [min]="isWeightProduct(item.product) ? 0.001 : 1"
                      [step]="isWeightProduct(item.product) ? 0.001 : 1"
                      (change)="recalcItem(item)"
                      class="w-16 text-center px-1 py-0.5 border rounded text-xs outline-none"
                      [style]="item.quantity > item.product.stockQty
                        ? 'border-color:#ef4444;color:#dc2626'
                        : 'border-color:#d1d5f0'"/>
                  </td>
                  <td class="px-2 py-1.5 text-right text-gray-700">&#2547;{{ item.unitPrice | number:'1.2-2' }}</td>
                  <td class="px-2 py-1.5 text-right font-semibold" style="color:var(--theme-primary)">
                    &#2547;{{ item.subtotal | number:'1.2-2' }}
                  </td>
                  <td class="px-2 py-1.5 text-center">
                    <button (click)="removeItem(i)" class="text-red-400 hover:text-red-600 transition">
                      <svg class="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M6 18L18 6M6 6l12 12"/>
                      </svg>
                    </button>
                  </td>
                </tr>
              </tbody>
            </table>
          </div>

          <div *ngIf="cartItems.length > 0"
               class="px-3 py-2 space-y-1 text-xs" style="border-top:1px solid #f0f2fb">
            <div class="flex justify-between text-gray-500">
              <span>Sub Total</span><span>&#2547;{{ subTotal | number:'1.2-2' }}</span>
            </div>
            <div class="flex justify-between items-center">
              <span class="text-gray-500">Discount</span>
              <div class="flex items-center gap-1">
                <span class="text-gray-400">&#2547;</span>
                <input type="number" [(ngModel)]="discount" min="0"
                  class="w-20 text-right px-1 py-0.5 border rounded text-xs outline-none"
                  style="border-color:#d1d5f0"/>
              </div>
            </div>
            <div class="flex justify-between items-center">
              <span class="text-gray-500">Transport</span>
              <div class="flex items-center gap-1">
                <span class="text-gray-400">&#2547;</span>
                <input type="number" [(ngModel)]="transport" min="0"
                  class="w-20 text-right px-1 py-0.5 border rounded text-xs outline-none"
                  style="border-color:#d1d5f0"/>
              </div>
            </div>
            <div class="flex justify-between font-bold text-sm pt-1"
                 style="border-top:1px solid var(--theme-text);color:var(--theme-primary)">
              <span>Grand Total</span>
              <span>&#2547;{{ grandTotal | number:'1.2-2' }}</span>
            </div>
          </div>
        </div>

        <!-- Customer Info -->
        <div class="bg-white rounded-xl shadow-md border overflow-hidden">
          <div class="px-3 py-2" style="background:var(--theme-primary-light)">
            <h3 class="text-white font-semibold text-xs flex items-center gap-2">
              <svg class="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2"
                  d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z"/>
              </svg>
              Customer Info
              <span class="ml-auto text-red-300 text-xs font-normal">* Phone required</span>
            </h3>
          </div>
          <div class="p-3 space-y-2">

            <!-- Customer Name (searchable dropdown) -->
            <div class="customer-search-wrap relative">
              <label class="block text-xs font-medium mb-1" style="color:#374151">
                Customer Name
                <span *ngIf="selectedCustomer" class="ml-1 text-green-600 text-xs">
                  (&#10003; matched)
                </span>
              </label>
              <div class="relative">
                <svg class="absolute left-2.5 top-2 w-3.5 h-3.5 text-gray-400 pointer-events-none"
                  fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2"
                    d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z"/>
                </svg>
                <input type="text"
                  [(ngModel)]="customerNameTerm"
                  (ngModelChange)="onCustomerSearch($event)"
                  (focus)="onCustomerFocus()"
                  (keydown)="onCustomerKeydown($event)"
                  placeholder="Search by name or walk-in…"
                  class="w-full pl-8 pr-8 py-1.5 text-xs border rounded-lg outline-none transition"
                  [style]="'border-color:' + (phoneError ? '#ef4444' : '#d1d5f0')"
                  onfocus="this.style.borderColor='var(--theme-primary)'" onblur="this.style.borderColor='#d1d5f0'"/>
                <!-- Clear button -->
                <button *ngIf="customerNameTerm" (click)="clearCustomer()"
                  class="absolute right-2 top-1.5 text-gray-400 hover:text-gray-600">
                  <svg class="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M6 18L18 6M6 6l12 12"/>
                  </svg>
                </button>
              </div>

              <!-- Customer dropdown -->
              <div *ngIf="showCustomerDropdown && filteredCustomers.length > 0"
                class="absolute z-30 w-full mt-1 bg-white border rounded-lg shadow-xl max-h-44 overflow-y-auto"
                style="border-color:#d1d5f0">
                <div *ngFor="let c of filteredCustomers; let i = index"
                  (mousedown)="selectCustomer(c)"
                  class="px-3 py-2 cursor-pointer text-xs transition"
                  [style]="i === customerIdx
                    ? 'background:var(--theme-primary);color:var(--theme-text)'
                    : 'color:#374151'"
                  onmouseover="this.style.background='#f0f2fb'"
                  onmouseout="">
                  <div class="font-semibold">{{ c.customerName }}</div>
                  <div class="opacity-60 flex gap-2">
                    <span *ngIf="c.phone">
                      <svg class="w-3 h-3 inline mr-0.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2"
                          d="M3 5a2 2 0 012-2h3.28a1 1 0 01.948.684l1.498 4.493a1 1 0 01-.502 1.21l-2.257 1.13a11.042 11.042 0 005.516 5.516l1.13-2.257a1 1 0 011.21-.502l4.493 1.498a1 1 0 01.684.949V19a2 2 0 01-2 2h-1C9.716 21 3 14.284 3 6V5z"/>
                      </svg>{{ c.phone }}</span>
                    <span *ngIf="c.address">{{ c.address | slice:0:25 }}</span>
                  </div>
                </div>
              </div>
              <!-- No match hint -->
              <div *ngIf="showCustomerDropdown && filteredCustomers.length === 0 && customerNameTerm.length >= 2"
                class="absolute z-30 w-full mt-1 bg-white border rounded-lg shadow-xl px-3 py-2 text-xs text-gray-400"
                style="border-color:#d1d5f0">
                No customer found — fill phone manually below
              </div>
            </div>

            <!-- Phone + Address row -->
            <div class="grid grid-cols-2 gap-2">
              <div>
                <label class="block text-xs font-medium mb-1" style="color:#374151">
                  Phone <span class="text-red-500">*</span>
                  <span class="ml-1 text-gray-400 font-normal">(max 11 digits)</span>
                </label>
                <input type="text"
                  [(ngModel)]="customerPhone"
                  (ngModelChange)="onPhoneChange($event)"
                  (blur)="validatePhone()"
                  placeholder="01XXXXXXXXX"
                  maxlength="11"
                  class="w-full px-2 py-1.5 text-xs border rounded outline-none transition"
                  [style]="'border-color:' + (phoneError ? '#ef4444' : '#d1d5f0')"
                  onfocus="this.style.borderColor='var(--theme-primary)'" onblur="this.style.borderColor='#d1d5f0'"/>
                <p *ngIf="phoneError" class="text-red-500 text-xs mt-0.5">{{ phoneError }}</p>
              </div>
              <div>
                <label class="block text-xs font-medium mb-1" style="color:#374151">Address</label>
                <input type="text"
                  [(ngModel)]="customerAddress"
                  placeholder="Optional"
                  class="w-full px-2 py-1.5 text-xs border rounded outline-none"
                  style="border-color:#d1d5f0"
                  onfocus="this.style.borderColor='var(--theme-primary)'" onblur="this.style.borderColor='#d1d5f0'"/>
              </div>
            </div>

            <!-- Notes -->
            <div>
              <label class="block text-xs font-medium mb-1" style="color:#374151">Notes</label>
              <textarea [(ngModel)]="notes" rows="2" placeholder="Special instructions…"
                class="w-full px-2 py-1.5 text-xs border rounded outline-none resize-none"
                style="border-color:#d1d5f0"
                onfocus="this.style.borderColor='var(--theme-primary)'" onblur="this.style.borderColor='#d1d5f0'">
              </textarea>
            </div>
          </div>
        </div>

        <!-- Save Order Button -->
        <button (click)="saveOrder()"
          [disabled]="saving || cartItems.length === 0"
          class="w-full py-3 rounded-xl text-sm font-bold text-white transition disabled:opacity-40 disabled:cursor-not-allowed flex items-center justify-center gap-2 shadow-md"
          style="background:var(--theme-primary)"
          onmouseover="if(!this.disabled) this.style.background='var(--theme-primary-light)'"
          onmouseout="if(!this.disabled) this.style.background='var(--theme-primary)'">
          <svg *ngIf="!saving" class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2"
              d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2m-6 9l2 2 4-4"/>
          </svg>
          <svg *ngIf="saving" class="w-4 h-4 animate-spin" fill="none" viewBox="0 0 24 24">
            <circle class="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" stroke-width="4"/>
            <path class="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v8z"/>
          </svg>
          {{ saving ? 'Saving Order…' : 'Save Order' }}
        </button>

      </div><!-- /right col -->
    </div><!-- /grid -->
  </div>
</div>
  `
})
export class OrderEntryComponent implements OnInit {

  @ViewChild('productSearchInput') productSearchInput!: ElementRef;
  @ViewChild('quantityInput')       quantityInput!: ElementRef;

  // ── Products ───────────────────────────────────────────────────
  products:         Product[] = [];
  filteredProducts: Product[] = [];
  searchTerm        = '';
  selectedProduct:  Product | null = null;
  selectedIdx       = -1;
  showDropdown      = false;

  // ── Cart ───────────────────────────────────────────────────────
  cartItems: OrderCartItem[] = [];
  qty        = 1;
  unitPrice  = 0;
  discount   = 0;
  transport  = 0;

  // ── Customer ───────────────────────────────────────────────────
  customers:         Customer[] = [];
  filteredCustomers: Customer[] = [];
  customerNameTerm   = '';
  customerPhone      = '';
  customerAddress    = '';
  selectedCustomer:  Customer | null = null;
  customerIdx        = -1;
  showCustomerDropdown = false;
  phoneError         = '';

  // ── Misc ───────────────────────────────────────────────────────
  notes   = '';
  saving  = false;
  today   = new Date();

  filters: ProductFilter = { tenantId: null, isActive: true, categoryId: null };

  constructor(
    private productSvc:  ProductService,
    private orderSvc:    OrderService,
    private customerSvc: CustomerService,
    private alertSvc:    AlertService,
    private router:      Router
  ) {}

  ngOnInit(): void {
    this.productSvc.getAllProducts(this.filters).subscribe({
      next: (res: any) => {
        this.products = Array.isArray(res) ? res : (res?.data ?? res?.items ?? []);
      }
    });
    this.customerSvc.getAllCustomers().subscribe({
      next: (res: any) => {
        this.customers = Array.isArray(res) ? res : (res?.data ?? []);
      }
    });
  }

  // ── Product search ─────────────────────────────────────────────
  onSearch(term: string): void {
    this.searchTerm  = term;
    this.selectedIdx = -1;
    if (!term.trim()) { this.filteredProducts = []; this.showDropdown = false; return; }
    const q = term.toLowerCase();
    this.filteredProducts = this.products
      .filter(p => p.productName.toLowerCase().includes(q) || (p.barcode?.toLowerCase().includes(q) ?? false))
      .slice(0, 12);
    this.showDropdown = this.filteredProducts.length > 0;
  }

  onKeydown(e: KeyboardEvent): void {
    if (!this.showDropdown) return;
    if (e.key === 'ArrowDown')  { e.preventDefault(); this.selectedIdx = Math.min(this.selectedIdx + 1, this.filteredProducts.length - 1); }
    else if (e.key === 'ArrowUp')   { e.preventDefault(); this.selectedIdx = Math.max(this.selectedIdx - 1, -1); }
    else if (e.key === 'Enter' && this.selectedIdx >= 0) { e.preventDefault(); this.selectProduct(this.filteredProducts[this.selectedIdx]); }
    else if (e.key === 'Escape')    { this.showDropdown = false; }
  }

  selectProduct(p: Product): void {
    this.selectedProduct = p;
    this.unitPrice       = p.salePrice;
    this.qty             = this.isWeight ? 0.5 : 1;
    this.searchTerm      = p.productName;
    this.showDropdown    = false;
    setTimeout(() => this.quantityInput?.nativeElement?.focus(), 50);
  }

  get isWeight(): boolean {
    return ['KG','G','L','ML'].includes((this.selectedProduct?.unitType || '').toUpperCase());
  }

  isWeightProduct(p: Product): boolean {
    return ['KG','G','L','ML'].includes((p?.unitType || '').toUpperCase());
  }

  // ── Customer search ────────────────────────────────────────────
  onCustomerSearch(term: string): void {
    this.customerNameTerm = term;
    this.selectedCustomer = null;  // reset match when typing
    this.customerIdx      = -1;
    if (!term.trim()) { this.filteredCustomers = []; this.showCustomerDropdown = false; return; }
    const q = term.toLowerCase();
    this.filteredCustomers = this.customers
      .filter(c => c.customerName?.toLowerCase().includes(q) || c.phone?.includes(term))
      .slice(0, 10);
    this.showCustomerDropdown = true;
  }

  onCustomerFocus(): void {
    if (this.customerNameTerm.trim().length > 0) {
      this.showCustomerDropdown = this.filteredCustomers.length > 0;
    }
  }

  onCustomerKeydown(e: KeyboardEvent): void {
    if (!this.showCustomerDropdown) return;
    if (e.key === 'ArrowDown')  { e.preventDefault(); this.customerIdx = Math.min(this.customerIdx + 1, this.filteredCustomers.length - 1); }
    else if (e.key === 'ArrowUp')   { e.preventDefault(); this.customerIdx = Math.max(this.customerIdx - 1, -1); }
    else if (e.key === 'Enter' && this.customerIdx >= 0) { e.preventDefault(); this.selectCustomer(this.filteredCustomers[this.customerIdx]); }
    else if (e.key === 'Escape')    { this.showCustomerDropdown = false; }
  }

  selectCustomer(c: Customer): void {
    this.selectedCustomer    = c;
    this.customerNameTerm    = c.customerName;
    this.customerPhone       = c.phone       || '';
    this.customerAddress     = c.address     || '';
    this.showCustomerDropdown = false;
    this.customerIdx         = -1;
    this.phoneError          = '';   // auto-filled → clear error
  }

  clearCustomer(): void {
    this.selectedCustomer    = null;
    this.customerNameTerm    = '';
    this.customerPhone       = '';
    this.customerAddress     = '';
    this.filteredCustomers   = [];
    this.showCustomerDropdown = false;
    this.phoneError          = '';
  }

  // ── Phone validation ───────────────────────────────────────────
  onPhoneChange(val: string): void {
    // Strip non-digits, cap at 11
    this.customerPhone = val.replace(/\D/g, '').slice(0, 11);
    if (this.phoneError) this.validatePhone();
  }

  validatePhone(): boolean {
    if (!this.customerPhone.trim()) {
      this.phoneError = 'Phone number is required.';
      return false;
    }
    if (this.customerPhone.length > 11) {
      this.phoneError = 'Maximum 11 digits.';
      return false;
    }
    this.phoneError = '';
    return true;
  }

  // ── Cart ───────────────────────────────────────────────────────
  addToCart(): void {
    if (!this.selectedProduct) return;
    if (this.qty <= 0) {
      this.alertSvc.warning('Quantity must be greater than 0.', 'Invalid Qty');
      return;
    }

    const stock = this.selectedProduct.stockQty;

    // Out of stock check
    if (stock <= 0) {
      this.alertSvc.warning(
        `"${this.selectedProduct.productName}" is out of stock.`,
        'Out of Stock'
      );
      return;
    }

    const existing = this.cartItems.find(i => i.productId === this.selectedProduct!.productId);
    const totalQty = existing ? existing.quantity + this.qty : this.qty;

    // Exceed stock check
    if (totalQty > stock) {
      this.alertSvc.warning(
        `Only ${stock} unit(s) of "${this.selectedProduct.productName}" in stock.\n` +
        `Already in cart: ${existing?.quantity ?? 0}. You tried to add: ${this.qty}.`,
        'Insufficient Stock'
      );
      return;
    }

    if (existing) {
      existing.quantity += this.qty;
      existing.subtotal  = +(existing.quantity * existing.unitPrice).toFixed(2);
    } else {
      this.cartItems.push({
        productId: this.selectedProduct.productId,
        product:   this.selectedProduct,
        quantity:  this.qty,
        unitPrice: this.unitPrice,
        subtotal:  +(this.qty * this.unitPrice).toFixed(2)
      });
    }
    this.selectedProduct  = null;
    this.searchTerm       = '';
    this.filteredProducts = [];
    this.qty = 1;
    setTimeout(() => this.productSearchInput?.nativeElement?.focus(), 50);
  }

  recalcItem(item: OrderCartItem): void {
    const minQty = this.isWeightProduct(item.product) ? 0.001 : 1;
    item.quantity = Math.max(minQty, item.quantity);
    // Warn if exceeds stock but don't block (allow saving as order/reservation)
    if (item.quantity > item.product.stockQty && item.product.stockQty > 0) {
      this.alertSvc.warning(
        `Qty ${item.quantity} exceeds available stock (${item.product.stockQty}) for "${item.product.productName}".`,
        'Stock Warning'
      );
    }
    item.subtotal = +(item.quantity * item.unitPrice).toFixed(2);
  }

  removeItem(idx: number): void { this.cartItems.splice(idx, 1); }
  clearCart():              void { this.cartItems = []; }

  get subTotal():   number { return +this.cartItems.reduce((s, i) => s + i.subtotal, 0).toFixed(2); }
  get grandTotal(): number { return +(this.subTotal - (this.discount || 0) + (this.transport || 0)).toFixed(2); }

  // ── Save ───────────────────────────────────────────────────────
  async saveOrder(): Promise<void> {
    if (this.cartItems.length === 0) {
      await this.alertSvc.warning('Add at least one product to the order.', 'Empty Cart');
      return;
    }
    if (!this.validatePhone()) {
      await this.alertSvc.warning('Phone number is required (max 11 digits).', 'Validation Error');
      return;
    }

    // Final stock check across entire cart
    const stockErrors = this.cartItems
      .filter(i => i.quantity > i.product.stockQty)
      .map(i => `• ${i.product.productName}: need ${i.quantity}, available ${i.product.stockQty}`);

    if (stockErrors.length > 0) {
      await this.alertSvc.warning(
        'The following items exceed available stock:\n' + stockErrors.join('\n'),
        'Insufficient Stock'
      );
      return;
    }

    const req: CreateOrderRequest = {
      customerName:  this.customerNameTerm || undefined,
      customerPhone: this.customerPhone,
      notes:         this.notes || undefined,
      discount:      this.discount  || 0,
      transport:     this.transport || 0,
      items: this.cartItems.map(i => ({
        productId:   i.productId,
        productName: i.product.productName,
        unitType:    i.product.unitType || 'PCS',
        quantity:    i.quantity,
        unitPrice:   i.unitPrice,
        total:       i.subtotal
      }))
    };

    this.saving = true;
    this.orderSvc.createOrder(req).subscribe({
      next: async res => {
        this.saving = false;
        await this.alertSvc.success(
          `Order #${res.data.orderId} saved!\nTotal: &#2547;${this.grandTotal.toFixed(2)}`,
          'Order Created'
        );
        this.router.navigate(['/orders']);
      },
      error: async err => {
        this.saving = false;
        await this.alertSvc.error(err?.error?.message || 'Failed to save order.', 'Error');
      }
    });
  }

  goBack(): void { this.router.navigate(['/orders']); }

  @HostListener('document:click', ['$event'])
  onDocClick(e: MouseEvent): void {
    const t = e.target as HTMLElement;
    if (!t.closest('.product-search-wrap'))  this.showDropdown = false;
    if (!t.closest('.customer-search-wrap')) this.showCustomerDropdown = false;
  }
}
