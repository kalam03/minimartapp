import { Component, OnInit, HostListener, ViewChild, ElementRef } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { Router } from '@angular/router';
import { ProductService } from '../../services/product.service';
import { Product, ProductFilter } from '../../models/product';
import { AlertService } from '../../shared/alert.service';
import { OrderService, CreateOrderRequest } from '../../services/order.service';

interface OrderCartItem {
  productId:   number;
  product:     Product;
  quantity:    number;
  unitPrice:   number;
  subtotal:    number;
}

@Component({
  selector: 'app-order-entry',
  standalone: true,
  imports: [CommonModule, FormsModule],
  template: `
<div class="px-3 py-2">
  <div class="max-w-8xl mx-auto">

    <!-- Header -->
    <div class="rounded-xl overflow-hidden border mb-3 shadow-md" style="background:#1a1c4e">
      <div class="px-4 py-3 flex items-center justify-between">
        <div class="flex items-center gap-3">
          <button (click)="goBack()"
            class="p-1.5 rounded-lg transition" style="color:#ACB3E7"
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
            <p class="text-xs" style="color:#ACB3E7">Add products and save as a pending order</p>
          </div>
        </div>
        <div class="text-xs" style="color:#ACB3E7">{{ today | date:'dd MMM yyyy' }}</div>
      </div>
    </div>

    <!-- Main Grid -->
    <div class="grid grid-cols-1 lg:grid-cols-2 gap-3">

      <!-- LEFT: Product Selection -->
      <div class="bg-white rounded-xl shadow-md border overflow-hidden">
        <div class="px-3 py-2" style="background:#1a1c4e">
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
          <div class="relative mb-3">
            <input #productSearchInput type="text"
              [ngModel]="searchTerm" (ngModelChange)="onSearch($event)"
              (keydown)="onKeydown($event)"
              placeholder="Search product by name or barcode…"
              class="w-full pl-8 pr-3 py-2 text-sm border rounded-lg outline-none focus:border-indigo-400"
              style="border-color:#d1d5f0"/>
            <svg class="absolute left-2.5 top-2.5 w-3.5 h-3.5 text-gray-400"
              fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2"
                d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z"/>
            </svg>

            <!-- Dropdown -->
            <div *ngIf="showDropdown && filteredProducts.length > 0"
              class="absolute z-20 w-full mt-1 bg-white border rounded-lg shadow-xl max-h-52 overflow-y-auto"
              style="border-color:#d1d5f0">
              <div *ngFor="let p of filteredProducts; let i = index"
                (click)="selectProduct(p)"
                class="px-3 py-2 cursor-pointer flex items-center justify-between text-xs transition"
                [style]="i === selectedIdx
                  ? 'background:#1a1c4e;color:#fff'
                  : 'color:#374151'"
                onmouseover="this.style.background='#f0f2fb'"
                onmouseout="if(this.dataset.i !== document.activeElement?.dataset?.idx) this.style.background=''">
                <div>
                  <div class="font-semibold">{{ p.productName }}</div>
                  <div class="text-gray-400">{{ p.categoryName }} · {{ p.unitType || 'PCS' }}</div>
                </div>
                <div class="text-right">
                  <div class="font-semibold">৳{{ p.salePrice | number:'1.2-2' }}</div>
                  <div [style]="p.stockQty <= 0 ? 'color:#ef4444' : 'color:#10b981'">
                    Stock: {{ p.stockQty }}
                  </div>
                </div>
              </div>
            </div>
          </div>

          <!-- Selected product controls -->
          <div *ngIf="selectedProduct" class="rounded-lg p-3 mb-3" style="background:#f0f2fb;border:1px solid #e0e3f8">
            <div class="flex items-start justify-between mb-2">
              <div>
                <p class="font-semibold text-sm" style="color:#1a1c4e">{{ selectedProduct.productName }}</p>
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
                  style="background:#1a1c4e"
                  onmouseover="this.style.background='#252862'"
                  onmouseout="this.style.background='#1a1c4e'">
                  + Add
                </button>
              </div>
            </div>
          </div>

          <!-- No selection placeholder -->
          <div *ngIf="!selectedProduct"
               class="text-center text-gray-400 py-6 text-xs">
            Search and select a product to add it to the order
          </div>
        </div>
      </div>

      <!-- RIGHT: Cart + Customer Info + Save -->
      <div class="flex flex-col gap-3">

        <!-- Cart -->
        <div class="bg-white rounded-xl shadow-md border overflow-hidden flex-1">
          <div class="px-3 py-2 flex items-center justify-between" style="background:#1a1c4e">
            <h2 class="text-white font-semibold text-sm flex items-center gap-2">
              <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2"
                  d="M3 3h2l.4 2M7 13h10l4-8H5.4M7 13L5.4 5M7 13l-2.293 2.293c-.63.63-.184 1.707.707 1.707H17m0 0a2 2 0 100 4 2 2 0 000-4zm-8 2a2 2 0 11-4 0 2 2 0 014 0z"/>
              </svg>
              Cart ({{ cartItems.length }})
            </h2>
            <button *ngIf="cartItems.length > 0" (click)="clearCart()"
              class="text-xs px-2 py-0.5 rounded font-medium transition"
              style="color:#ACB3E7"
              onmouseover="this.style.color='#ef4444'" onmouseout="this.style.color='#ACB3E7'">
              Clear All
            </button>
          </div>

          <!-- Empty cart -->
          <div *ngIf="cartItems.length === 0"
               class="p-8 text-center text-gray-400 text-xs">
            <svg class="w-8 h-8 mx-auto mb-2 opacity-30" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path stroke-linecap="round" stroke-linejoin="round" stroke-width="1.5"
                d="M3 3h2l.4 2M7 13h10l4-8H5.4M7 13L5.4 5M7 13l-2.293 2.293c-.63.63-.184 1.707.707 1.707H17"/>
            </svg>
            No items yet. Search and add products.
          </div>

          <!-- Cart items -->
          <div *ngIf="cartItems.length > 0" class="overflow-x-auto">
            <table class="w-full text-xs">
              <thead>
                <tr style="background:#e0e3f8;color:#1a1c4e">
                  <th class="px-3 py-1.5 text-left">Product</th>
                  <th class="px-2 py-1.5 text-center w-20">Qty</th>
                  <th class="px-2 py-1.5 text-right w-24">Price</th>
                  <th class="px-2 py-1.5 text-right w-24">Total</th>
                  <th class="px-2 py-1.5 w-8"></th>
                </tr>
              </thead>
              <tbody>
                <tr *ngFor="let item of cartItems; let i = index"
                    [class]="i%2===0 ? 'bg-white' : 'bg-gray-50'"
                    class="border-b">
                  <td class="px-3 py-1.5">
                    <div class="font-medium text-gray-800">{{ item.product.productName }}</div>
                    <div class="text-gray-400">{{ item.product.unitType || 'PCS' }}</div>
                  </td>
                  <td class="px-2 py-1.5 text-center">
                    <input type="number" [(ngModel)]="item.quantity"
                      [min]="isWeightProduct(item.product) ? 0.001 : 1"
                      [step]="isWeightProduct(item.product) ? 0.001 : 1"
                      (change)="recalcItem(item)"
                      class="w-16 text-center px-1 py-0.5 border rounded text-xs outline-none"
                      style="border-color:#d1d5f0"/>
                  </td>
                  <td class="px-2 py-1.5 text-right text-gray-700">৳{{ item.unitPrice | number:'1.2-2' }}</td>
                  <td class="px-2 py-1.5 text-right font-semibold" style="color:#1a1c4e">
                    ৳{{ item.subtotal | number:'1.2-2' }}
                  </td>
                  <td class="px-2 py-1.5 text-center">
                    <button (click)="removeItem(i)"
                      class="text-red-400 hover:text-red-600 transition">
                      <svg class="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2"
                          d="M6 18L18 6M6 6l12 12"/>
                      </svg>
                    </button>
                  </td>
                </tr>
              </tbody>
            </table>
          </div>

          <!-- Totals -->
          <div *ngIf="cartItems.length > 0"
               class="px-3 py-2 space-y-1 text-xs" style="border-top:1px solid #f0f2fb">
            <div class="flex justify-between text-gray-500">
              <span>Sub Total</span>
              <span>৳{{ subTotal | number:'1.2-2' }}</span>
            </div>
            <div class="flex justify-between items-center">
              <span class="text-gray-500">Discount</span>
              <div class="flex items-center gap-1">
                <span class="text-gray-400">৳</span>
                <input type="number" [(ngModel)]="discount" min="0"
                  class="w-20 text-right px-1 py-0.5 border rounded text-xs outline-none"
                  style="border-color:#d1d5f0"/>
              </div>
            </div>
            <div class="flex justify-between items-center">
              <span class="text-gray-500">Transport</span>
              <div class="flex items-center gap-1">
                <span class="text-gray-400">৳</span>
                <input type="number" [(ngModel)]="transport" min="0"
                  class="w-20 text-right px-1 py-0.5 border rounded text-xs outline-none"
                  style="border-color:#d1d5f0"/>
              </div>
            </div>
            <div class="flex justify-between font-bold text-sm pt-1"
                 style="border-top:1px solid #e0e3f8;color:#1a1c4e">
              <span>Grand Total</span>
              <span>৳{{ grandTotal | number:'1.2-2' }}</span>
            </div>
          </div>
        </div>

        <!-- Customer + Notes -->
        <div class="bg-white rounded-xl shadow-md border overflow-hidden">
          <div class="px-3 py-2" style="background:#252862">
            <h3 class="text-white font-semibold text-xs flex items-center gap-2">
              <svg class="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2"
                  d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z"/>
              </svg>
              Customer Info (optional)
            </h3>
          </div>
          <div class="p-3 grid grid-cols-2 gap-2">
            <div>
              <label class="block text-xs text-gray-500 mb-1">Customer Name</label>
              <input type="text" [(ngModel)]="customerName" placeholder="Walk-in customer"
                class="w-full px-2 py-1.5 text-xs border rounded outline-none"
                style="border-color:#d1d5f0"
                onfocus="this.style.borderColor='#1a1c4e'" onblur="this.style.borderColor='#d1d5f0'"/>
            </div>
            <div>
              <label class="block text-xs text-gray-500 mb-1">Phone</label>
              <input type="text" [(ngModel)]="customerPhone" placeholder="01XXXXXXXXX"
                class="w-full px-2 py-1.5 text-xs border rounded outline-none"
                style="border-color:#d1d5f0"
                onfocus="this.style.borderColor='#1a1c4e'" onblur="this.style.borderColor='#d1d5f0'"/>
            </div>
            <div class="col-span-2">
              <label class="block text-xs text-gray-500 mb-1">Notes / Special Instructions</label>
              <textarea [(ngModel)]="notes" rows="2" placeholder="Any special instructions…"
                class="w-full px-2 py-1.5 text-xs border rounded outline-none resize-none"
                style="border-color:#d1d5f0"
                onfocus="this.style.borderColor='#1a1c4e'" onblur="this.style.borderColor='#d1d5f0'">
              </textarea>
            </div>
          </div>
        </div>

        <!-- Save Order Button -->
        <button (click)="saveOrder()"
          [disabled]="saving || cartItems.length === 0"
          class="w-full py-3 rounded-xl text-sm font-bold text-white transition disabled:opacity-40 disabled:cursor-not-allowed flex items-center justify-center gap-2 shadow-md"
          style="background:#1a1c4e"
          onmouseover="if(!this.disabled) this.style.background='#252862'"
          onmouseout="if(!this.disabled) this.style.background='#1a1c4e'">
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

  // Products
  products:        Product[] = [];
  filteredProducts: Product[] = [];
  searchTerm       = '';
  selectedProduct: Product | null = null;
  selectedIdx      = -1;
  showDropdown     = false;

  // Cart
  cartItems: OrderCartItem[] = [];
  qty       = 1;
  unitPrice = 0;

  // Totals
  discount  = 0;
  transport = 0;

  // Customer
  customerName  = '';
  customerPhone = '';
  notes         = '';

  // State
  saving = false;
  today  = new Date();

  filters: ProductFilter = { tenantId: null, isActive: true, categoryId: null };

  constructor(
    private productSvc: ProductService,
    private orderSvc:   OrderService,
    private alertSvc:   AlertService,
    private router:     Router
  ) {}

  ngOnInit(): void {
    this.productSvc.getAllProducts(this.filters).subscribe({
      next: (res: any) => {
        this.products = Array.isArray(res) ? res : (res?.data ?? res?.items ?? []);
      }
    });
  }

  // ── Product search ─────────────────────────────────────────────
  onSearch(term: string): void {
    this.searchTerm  = term;
    this.selectedIdx = -1;
    if (!term.trim()) {
      this.filteredProducts = [];
      this.showDropdown = false;
      return;
    }
    const q = term.toLowerCase();
    this.filteredProducts = this.products
      .filter(p => p.productName.toLowerCase().includes(q) ||
                   (p.barcode?.toLowerCase().includes(q) ?? false))
      .slice(0, 12);
    this.showDropdown = this.filteredProducts.length > 0;
  }

  onKeydown(e: KeyboardEvent): void {
    if (!this.showDropdown) return;
    if (e.key === 'ArrowDown') {
      e.preventDefault();
      this.selectedIdx = Math.min(this.selectedIdx + 1, this.filteredProducts.length - 1);
    } else if (e.key === 'ArrowUp') {
      e.preventDefault();
      this.selectedIdx = Math.max(this.selectedIdx - 1, -1);
    } else if (e.key === 'Enter' && this.selectedIdx >= 0) {
      e.preventDefault();
      this.selectProduct(this.filteredProducts[this.selectedIdx]);
    } else if (e.key === 'Escape') {
      this.showDropdown = false;
    }
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

  // ── Cart ───────────────────────────────────────────────────────
  addToCart(): void {
    if (!this.selectedProduct) return;
    if (this.qty <= 0) {
      this.alertSvc.warning('Quantity must be greater than 0', 'Invalid Qty');
      return;
    }

    const existing = this.cartItems.find(i => i.productId === this.selectedProduct!.productId);
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

    this.selectedProduct = null;
    this.searchTerm      = '';
    this.filteredProducts = [];
    this.qty = 1;
    setTimeout(() => this.productSearchInput?.nativeElement?.focus(), 50);
  }

  recalcItem(item: OrderCartItem): void {
    item.quantity = Math.max(this.isWeightProduct(item.product) ? 0.001 : 1, item.quantity);
    item.subtotal = +(item.quantity * item.unitPrice).toFixed(2);
  }

  removeItem(idx: number): void {
    this.cartItems.splice(idx, 1);
  }

  clearCart(): void {
    this.cartItems = [];
  }

  // ── Totals ─────────────────────────────────────────────────────
  get subTotal(): number {
    return +this.cartItems.reduce((s, i) => s + i.subtotal, 0).toFixed(2);
  }

  get grandTotal(): number {
    return +(this.subTotal - (this.discount || 0) + (this.transport || 0)).toFixed(2);
  }

  // ── Save ───────────────────────────────────────────────────────
  async saveOrder(): Promise<void> {
    if (this.cartItems.length === 0) {
      await this.alertSvc.warning('Add at least one product to the order.', 'Empty Cart');
      return;
    }

    const req: CreateOrderRequest = {
      customerName:  this.customerName || undefined,
      customerPhone: this.customerPhone || undefined,
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
          `Order #${res.data.orderId} saved successfully!\nTotal: ৳${this.grandTotal.toFixed(2)}`,
          'Order Created'
        );
        this.router.navigate(['/orders']);
      },
      error: async err => {
        this.saving = false;
        await this.alertSvc.error(
          err?.error?.message || 'Failed to save order.',
          'Error'
        );
      }
    });
  }

  goBack(): void {
    this.router.navigate(['/orders']);
  }

  @HostListener('document:click', ['$event'])
  onDocClick(e: MouseEvent): void {
    const target = e.target as HTMLElement;
    if (!target.closest('.product-search-wrap')) {
      this.showDropdown = false;
    }
  }
}
