import { Component, EventEmitter, Input, Output } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { Product } from '../models/product';

/**
 * Reusable "pick one or more products" control — a search box that opens a
 * checkbox dropdown, used by the Product Discount and Combo Offer admin
 * screens (Promotion & Loyalty module). Mirrors pos-billing's search/dropdown
 * shell (text input + absolutely-positioned list + keyboard-free click
 * selection), just with checkboxes instead of single-select.
 *
 * Usage: <app-product-picker [products]="allProducts" [(selectedIds)]="form.productIds"></app-product-picker>
 */
@Component({
  selector: 'app-product-picker',
  standalone: true,
  imports: [CommonModule, FormsModule],
  template: `
    <div class="relative">
      <input type="text" [(ngModel)]="searchText" (focus)="open = true" (blur)="onBlur()"
        placeholder="Search products to select…"
        class="w-full px-2 py-1.5 text-sm border border-gray-400 rounded-lg outline-none" />

      <div *ngIf="open" class="absolute z-50 w-full mt-1 bg-white border rounded-lg shadow-lg max-h-56 overflow-y-auto">
        <div *ngFor="let p of filteredProducts" (click)="toggle(p.productId)"
          class="flex items-center gap-2 px-2 py-1.5 text-sm hover:bg-gray-50 cursor-pointer">
          <input type="checkbox" [checked]="isSelected(p.productId)" (click)="$event.stopPropagation(); toggle(p.productId)" />
          <span class="flex-1">{{ p.productName }}</span>
          <span class="text-xs text-gray-400">{{ p.salePrice | number:'1.2-2' }}</span>
        </div>
        <div *ngIf="filteredProducts.length === 0" class="px-2 py-3 text-xs text-gray-400 text-center">No matching products</div>
      </div>
    </div>

    <div class="flex flex-wrap gap-1 mt-2" *ngIf="selectedIds.length > 0">
      <span *ngFor="let id of selectedIds" class="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs" style="background:var(--theme-primary);color:#fff">
        {{ nameOf(id) }}
        <button type="button" (click)="toggle(id)" class="leading-none">&times;</button>
      </span>
    </div>
  `
})
export class ProductPickerComponent {
  @Input() products: Product[] = [];
  @Input() selectedIds: number[] = [];
  @Output() selectedIdsChange = new EventEmitter<number[]>();

  searchText = '';
  open = false;

  get filteredProducts(): Product[] {
    const q = this.searchText.trim().toLowerCase();
    const base = q ? this.products.filter(p => p.productName.toLowerCase().includes(q)) : this.products;
    return base.slice(0, 30);
  }

  /** Delay closing so a click on a checkbox/row registers before the dropdown disappears. */
  onBlur(): void {
    setTimeout(() => (this.open = false), 200);
  }

  isSelected(id: number): boolean {
    return this.selectedIds.includes(id);
  }

  toggle(id: number): void {
    const next = this.isSelected(id)
      ? this.selectedIds.filter(x => x !== id)
      : [...this.selectedIds, id];
    this.selectedIdsChange.emit(next);
  }

  nameOf(id: number): string {
    return this.products.find(p => p.productId === id)?.productName || `#${id}`;
  }
}
