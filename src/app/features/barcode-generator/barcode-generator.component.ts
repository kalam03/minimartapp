import { Component, OnInit, ChangeDetectorRef } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import JsBarcode from 'jsbarcode';
import { TranslocoModule, TranslocoService, provideTranslocoScope } from '@jsverse/transloco';
import { ProductService } from '../../services/product.service';
import { CategoryService } from '../../services/category.service';
import { AlertService } from '../../shared/alert.service';
import { toLocalDateString } from '../../shared/date-utils';
import { Product, ProductFilter } from '../../models/product';

interface BarcodeLabel {
  product: Product;
  barcodeValue: string;
  canvasId: string;
}

@Component({
  selector: 'app-barcode-generator',
  standalone: true,
  imports: [CommonModule, FormsModule, TranslocoModule],
  // Loads assets/i18n/barcodeGenerator/{en,bn}.json only when this route is hit.
  providers: [provideTranslocoScope('barcodeGenerator')],
  templateUrl: './barcode-generator.component.html',
  styleUrls: ['./barcode-generator.component.css']
})
export class BarcodeGeneratorComponent implements OnInit {
  Math = Math;

  // ── Data ──────────────────────────────────────────────────────────────
  products: Product[] = [];
  categories: { id: number; name: string }[] = [];
  isLoading = false;
  errorMsg = '';

  // ── Filters — default to today ────────────────────────────────────────
  fromDate = toLocalDateString();
  toDate   = toLocalDateString();
  categoryFilter: number | '' = '';
  searchText = '';

  // ── Selection ─────────────────────────────────────────────────────────
  selectedIds = new Set<number>();

  // ── Barcode label settings ───────────────────────────────────────────
  barcodeWidth = 2;     // px per bar module (jsbarcode "width")
  barcodeHeight = 60;   // px bar height (jsbarcode "height")
  copies = 1;           // labels printed per selected product
  showProductName = true;
  showPrice = true;

  generatedLabels: BarcodeLabel[] = [];
  isGenerating = false;

  constructor(
    private productService: ProductService,
    private categoryService: CategoryService,
    private alertService: AlertService,
    private cdr: ChangeDetectorRef,
    private transloco: TranslocoService
  ) {}

  /** Shorthand for the 'barcodeGenerator' scope — see provideTranslocoScope above. */
  private t(key: string, params?: Record<string, unknown>): string {
    return this.transloco.translate(`barcodeGenerator.${key}`, params);
  }

  ngOnInit(): void {
    this.loadCategories();
    this.loadProducts();
  }

  loadCategories(): void {
    this.categoryService.getAllCategories(true).subscribe({
      next: (res) => {
        this.categories = (res.data || []).map(c => ({ id: c.categoryId, name: c.categoryName }));
      },
      error: () => { /* filter dropdown just stays empty on failure */ }
    });
  }

  loadProducts(): void {
    this.isLoading = true;
    this.errorMsg = '';

    const filter: ProductFilter = { isActive: true };
    if (this.fromDate) filter.fromDate = this.fromDate;
    if (this.toDate) filter.toDate = this.toDate;
    if (this.categoryFilter !== '') filter.categoryId = Number(this.categoryFilter);

    this.productService.getAllProducts(filter).subscribe({
      next: (response: any) => {
        this.products = Array.isArray(response) ? response : response.data || [];
        this.selectedIds.clear();
        this.isLoading = false;
        this.cdr.detectChanges();
      },
      error: (err: any) => {
        this.products = [];
        this.isLoading = false;
        this.errorMsg = err?.error?.message || this.t('messages.loadError');
        this.cdr.detectChanges();
      }
    });
  }

  applyFilter(): void {
    this.loadProducts();
  }

  resetFilter(): void {
    this.fromDate = toLocalDateString();
    this.toDate   = toLocalDateString();
    this.categoryFilter = '';
    this.searchText = '';
    this.loadProducts();
  }

  getCategoryName(categoryId: number | null | undefined): string {
    const cat = this.categories.find(c => c.id === categoryId);
    return cat ? cat.name : '—';
  }

  get filteredProducts(): Product[] {
    const q = this.searchText.toLowerCase().trim();
    if (!q) return this.products;
    return this.products.filter(p =>
      (p.productName || '').toLowerCase().includes(q) ||
      (p.barcode || '').toLowerCase().includes(q)
    );
  }

  // ── Row selection ─────────────────────────────────────────────────────
  isSelected(productId: number): boolean {
    return this.selectedIds.has(productId);
  }

  toggleSelect(productId: number): void {
    if (this.selectedIds.has(productId)) {
      this.selectedIds.delete(productId);
    } else {
      this.selectedIds.add(productId);
    }
  }

  get isAllVisibleSelected(): boolean {
    const visible = this.filteredProducts;
    return visible.length > 0 && visible.every(p => this.selectedIds.has(p.productId));
  }

  toggleSelectAll(event: Event): void {
    const checked = (event.target as HTMLInputElement).checked;
    if (checked) {
      this.filteredProducts.forEach(p => this.selectedIds.add(p.productId));
    } else {
      this.filteredProducts.forEach(p => this.selectedIds.delete(p.productId));
    }
  }

  get selectedCount(): number {
    return this.selectedIds.size;
  }

  get selectedProducts(): Product[] {
    return this.products.filter(p => this.selectedIds.has(p.productId));
  }

  // ── Barcode value handling ────────────────────────────────────────────
  /** Products saved before this feature existed may have no Barcode value yet. */
  private buildBarcodeValue(product: Product): string {
    return product.barcode && product.barcode.trim()
      ? product.barcode.trim()
      : 'PRD' + product.productId.toString().padStart(8, '0');
  }

  /** Persist an auto-generated barcode back onto the product so future prints reuse the same code. */
  private persistBarcode(product: Product, barcodeValue: string): void {
    const payload = {
      tenantId: product.tenantId || 1,
      productName: product.productName,
      categoryId: product.categoryId,
      purchasePrice: product.purchasePrice,
      salePrice: product.salePrice,
      stockQty: product.stockQty,
      barcode: barcodeValue,
      unitType: product.unitType || 'PCS',
      isActive: product.isActive
    };
    this.productService.updateProduct(product.productId, payload).subscribe({
      next: () => { product.barcode = barcodeValue; },
      error: () => { /* label still prints; will just retry generating a code next time */ }
    });
  }

  // ── Generate + render ─────────────────────────────────────────────────
  generate(): void {
    if (this.selectedProducts.length === 0) {
      this.alertService.error(this.t('messages.selectAtLeastOne'));
      return;
    }
    if (this.barcodeWidth <= 0 || this.barcodeHeight <= 0) {
      this.alertService.error(this.t('messages.sizeMustBePositive'));
      return;
    }
    if (this.copies < 1) {
      this.copies = 1;
    }

    this.isGenerating = true;
    const labels: BarcodeLabel[] = [];

    this.selectedProducts.forEach((product, pIdx) => {
      const barcodeValue = this.buildBarcodeValue(product);
      if (!product.barcode || !product.barcode.trim()) {
        this.persistBarcode(product, barcodeValue);
      }
      for (let c = 0; c < this.copies; c++) {
        labels.push({
          product,
          barcodeValue,
          canvasId: `barcode-canvas-${pIdx}-${c}`
        });
      }
    });

    this.generatedLabels = labels;
    this.cdr.detectChanges();

    // Canvas elements only exist in the DOM after the *ngFor above renders.
    setTimeout(() => this.renderBarcodes(), 0);
  }

  private renderBarcodes(): void {
    this.generatedLabels.forEach(label => {
      const canvas = document.getElementById(label.canvasId);
      if (!canvas) return;
      try {
        JsBarcode(canvas, label.barcodeValue, {
          format: 'CODE128',
          width: this.barcodeWidth,
          height: this.barcodeHeight,
          displayValue: true,
          fontSize: 14,
          margin: 6
        });
      } catch {
        // Skip anything JsBarcode can't encode rather than breaking the whole preview.
      }
    });
    this.isGenerating = false;
  }

  clearGenerated(): void {
    this.generatedLabels = [];
  }

  print(): void {
    window.print();
  }
}
