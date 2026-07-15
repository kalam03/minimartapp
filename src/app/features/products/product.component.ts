import { Component, OnInit, ChangeDetectorRef } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { TranslocoModule, TranslocoService, provideTranslocoScope } from '@jsverse/transloco';
import { ProductService } from '../../services/product.service';
import { AlertService } from '../../shared/alert.service';
import { UnitTypeService } from '../../services/unit-type.service';
import { CategoryService } from '../../services/category.service';
import { BnNumberAccessorDirective } from '../../shared/bn-number-accessor.directive';

@Component({
  selector: 'app-product',
  standalone: true,
  imports: [CommonModule, FormsModule, TranslocoModule, BnNumberAccessorDirective],
  // Loads assets/i18n/products/{en,bn}.json only when this route is hit —
  // see Multilingual_Localization_Architecture.md Section 5.1.
  providers: [provideTranslocoScope('products')],
  templateUrl: './product.component.html',
  styleUrls: ['./product.component.css']
})
export class ProductComponent implements OnInit {
  products: any[] = [];
  editingId: number | null = null;
  Math = Math;

  // Fallback shown until the Unit Types API responds (or if it fails) so the
  // dropdown is never empty. Manage the real list from the Unit Types page.
  unitTypes: { code: string; label: string; isWeight: boolean }[] = [
    // { code: 'PCS', label: 'Piece / Count',  isWeight: false },
    // { code: 'KG',  label: 'Kilogram (kg)',  isWeight: true  },
    // { code: 'G',   label: 'Gram (g)',       isWeight: true  },
    // { code: 'L',   label: 'Litre (L)',      isWeight: true  },
    // { code: 'ML',  label: 'Millilitre (mL)',isWeight: true  },
    // { code: 'DOZ', label: 'Dozen',          isWeight: false },
    // { code: 'BOX', label: 'Box',            isWeight: false },
  ];

  productForm = {
    productName: '',
    categoryId: 1,
    purchasePrice: 0.00,
    salePrice: 0.00,
    stockQty: 0.00,
    barcode: '',
    unitType: 'PCS',
    isActive: true
  };

  validationErrors = {
    productName: '',
    categoryId: '',
    purchasePrice: '',
    salePrice: '',
    stockQty: '',
    barcode: ''
  };

  // Populated from the real Categories table on load. Manage the list from
  // the Categories page — this used to be a hardcoded, disconnected list.
  categories: { id: number; name: string }[] = [];

  pageSize = 10;
  currentPage = 1;
  sortBy = 'productName';
  sortOrder: 'asc' | 'desc' = 'asc';
  searchText = '';
  categoryFilter: number | '' = '';

  constructor(
    private productService: ProductService,
    private alertService: AlertService,
    private unitTypeService: UnitTypeService,
    private categoryService: CategoryService,
    private cdr: ChangeDetectorRef,
    private transloco: TranslocoService
  ) {}

  /** Shorthand for the 'products' scope — see provideTranslocoScope above. */
  private t(key: string, params?: Record<string, unknown>): string {
    return this.transloco.translate(`products.${key}`, params);
  }

  ngOnInit(): void {
    this.getAllProducts();
    this.loadUnitTypes();
    this.loadCategories();
  }

  /** Pull the live category list from the Categories master table */
  loadCategories(): void {
    this.categoryService.getAllCategories(true).subscribe({
      next: (res) => {
        this.categories = (res.data || []).map(c => ({
          id: c.categoryId,
          name: c.categoryName
        }));
      },
      error: (err: any) => {
        this.alertService.error(this.t('messages.loadCategoriesError', { error: err.error?.message || err.message }));
      }
    });
  }

  /** Pull the live unit type list from the Unit Types master table (falls back to the built-in list on error) */
  loadUnitTypes(): void {
    this.unitTypeService.getAllUnitTypes(true).subscribe({
      next: (res) => {
        if (res.data && res.data.length > 0) {
          this.unitTypes = res.data.map(u => ({
            code: u.unitCode,
            label: u.unitName,
            isWeight: u.isWeight
          }));
        }
      },
      error: () => {
        // Keep the built-in fallback list — don't block product entry if this call fails.
      }
    });
  }

  getCategoryName(categoryId: number): string {
    const category = this.categories.find(c => c.id === categoryId);
    return category ? category.name : this.t('messages.unknownCategory');
  }

  validateField(fieldName: string): void {
    const value = (this.productForm as any)[fieldName]?.toString().trim() || '';
    this.validationErrors[fieldName as keyof typeof this.validationErrors] = '';

    switch (fieldName) {
      case 'productName':
        if (!value) {
          this.validationErrors.productName = this.t('validation.nameRequired');
        } else if (value.length < 2) {
          this.validationErrors.productName = this.t('validation.nameMinLength');
        } else if (value.length > 100) {
          this.validationErrors.productName = this.t('validation.nameMaxLength');
        }
        break;
      case 'categoryId':
        if (!value || value === '0') {
          this.validationErrors.categoryId = this.t('validation.categoryRequired');
        }
        break;
      case 'purchasePrice':
        if (!value || value === '' || value === '0') {
          this.validationErrors.purchasePrice = this.t('validation.purchasePriceRequired');
        } else if (isNaN(Number(value))) {
          this.validationErrors.purchasePrice = this.t('validation.purchasePriceInvalid');
        } else if (Number(value) <= 0) {
          this.validationErrors.purchasePrice = this.t('validation.purchasePricePositive');
        }
        break;
      case 'salePrice':
        if (!value || value === '' || value === '0') {
          this.validationErrors.salePrice = this.t('validation.salePriceRequired');
        } else if (isNaN(Number(value))) {
          this.validationErrors.salePrice = this.t('validation.salePriceInvalid');
        } else if (Number(value) <= 0) {
          this.validationErrors.salePrice = this.t('validation.salePricePositive');
        } else if (Number(value) < Number(this.productForm.purchasePrice)) {
          this.validationErrors.salePrice = this.t('validation.salePriceLessThanPurchase', {
            price: Number(this.productForm.purchasePrice).toFixed(2)
          });
        }
        break;
    }
  }

  validateForm(): boolean {
    // Only validate visible fields; barcode and stockQty are hidden (auto/purchase-managed)
    const fieldsToValidate = ['productName', 'categoryId', 'purchasePrice', 'salePrice'];
    fieldsToValidate.forEach(field => this.validateField(field));
    return Object.values(this.validationErrors).every(error => !error);
  }

  clearValidationErrors(): void {
    Object.keys(this.validationErrors).forEach(key => {
      this.validationErrors[key as keyof typeof this.validationErrors] = '';
    });
  }

  saveProduct(): void {
    if (!this.validateForm()) {
      return;
    }

    if (this.editingId) {
      this.updateProduct();
    } else {
      this.createProduct();
    }
  }

  createProduct(): void {
    const payload = {
      tenantId: 1,
      ...this.productForm
    };

    this.productService.createProduct(payload).subscribe({
      next: (response: any) => {
        this.alertService.success(this.t('messages.createSuccess'));
        this.resetForm();
        this.getAllProducts();
      },
      error: (err: any) => {
        console.error('Error creating product:', err);
        this.alertService.error(this.t('messages.createError', { error: err.error?.message || err.message }));
      }
    });
  }

  editProduct(product: any): void {
    this.editingId = product.productId;
    this.productForm = {
      productName: product.productName,
      categoryId: product.categoryId,
      purchasePrice: product.purchasePrice || 0,
      salePrice: product.salePrice || 0,
      stockQty: product.stockQty || 0,
      barcode: product.barcode || '',
      unitType: product.unitType || 'PCS',
      isActive: product.isActive
    };
    this.clearValidationErrors();
    window.scrollTo({ top: 0, behavior: 'smooth' });
  }

  updateProduct(): void {
    if (this.editingId === null) return;

    const payload = {
      tenantId: 1,
      ...this.productForm
    };

    this.productService.updateProduct(this.editingId, payload).subscribe({
      next: (response: any) => {
        this.alertService.success(this.t('messages.updateSuccess'));
        this.resetForm();
        this.editingId = null;
        this.getAllProducts();
      },
      error: (err: any) => {
        console.error('Error updating product:', err);
        this.alertService.error(this.t('messages.updateError', { error: err.error?.message || err.message }));
      }
    });
  }

  cancelEdit(): void {
    this.resetForm();
    this.editingId = null;
    this.clearValidationErrors();
  }

  deleteProduct(id: number, name: string): void {
    this.alertService.confirm(this.t('messages.deleteConfirm', { name })).then((confirmed: boolean) => {
      if (confirmed) {
        this.productService.deleteProduct(id).subscribe({
          next: (response: any) => {
            this.alertService.success(this.t('messages.deleteSuccess'));
            this.getAllProducts();
          },
          error: (err: any) => {
            console.error('Error deleting product:', err);
            this.alertService.error(this.t('messages.deleteError', { error: err.error?.message || err.message }));
          }
        });
      }
    });
  }

  getAllProducts(): void {
    this.productService.getAllProducts().subscribe({
      next: (response: any) => {
        this.products = Array.isArray(response) ? response : response.data || [];
        this.currentPage = 1;
        this.cdr.detectChanges();
      },
      error: (err: any) => {
        console.error('Error loading products:', err);
        this.products = [];
        this.alertService.error(this.t('messages.loadError', { error: err.error?.message || err.message }));
      }
    });
  }

  setSortColumn(column: string): void {
    if (this.sortBy === column) {
      this.sortOrder = this.sortOrder === 'asc' ? 'desc' : 'asc';
    } else {
      this.sortBy = column;
      this.sortOrder = 'asc';
    }
    this.currentPage = 1;
  }

  get filteredProducts(): any[] {
    const q = this.searchText.toLowerCase().trim();
    return this.products.filter(p => {
      const matchesSearch = !q ||
        (p.productName || '').toLowerCase().includes(q) ||
        (p.barcode || '').toLowerCase().includes(q) ||
        this.getCategoryName(p.categoryId).toLowerCase().includes(q);
      const matchesCategory = this.categoryFilter === '' || p.categoryId == this.categoryFilter;
      return matchesSearch && matchesCategory;
    });
  }

  get sortedProducts(): any[] {
    const sorted = [...this.filteredProducts].sort((a, b) => {
      let aVal = a[this.sortBy];
      let bVal = b[this.sortBy];

      if (typeof aVal === 'string') {
        aVal = aVal.toLowerCase();
        bVal = bVal.toLowerCase();
      }

      const comparison = aVal < bVal ? -1 : aVal > bVal ? 1 : 0;
      return this.sortOrder === 'asc' ? comparison : -comparison;
    });
    return sorted;
  }

  get paginatedProducts(): any[] {
    const start = (this.currentPage - 1) * this.pageSize;
    return this.sortedProducts.slice(start, start + this.pageSize);
  }

  get totalPages(): number {
    return Math.ceil(this.filteredProducts.length / this.pageSize) || 1;
  }

  nextPage(): void {
    if (this.currentPage < this.totalPages) {
      this.currentPage++;
    }
  }

  prevPage(): void {
    if (this.currentPage > 1) {
      this.currentPage--;
    }
  }

  goToPage(page: number): void {
    if (page >= 1 && page <= this.totalPages) {
      this.currentPage = page;
    }
  }

  resetForm(): void {
    this.productForm = {
      productName: '',
      categoryId: 1,
      purchasePrice: 0.00,
      salePrice: 0.00,
      stockQty: 0.00,
      barcode: '',
      unitType: 'PCS',
      isActive: true
    };
    this.clearValidationErrors();
  }

  getSortIcon(column: string): string {
    if (this.sortBy !== column) return '↕';
    return this.sortOrder === 'asc' ? '↑' : '↓';
  }

  isFieldInvalid(fieldName: string): boolean {
    return !!this.validationErrors[fieldName as keyof typeof this.validationErrors];
  }

  getStockStatusColor(stockQty: number): string {
    if (stockQty > 50) return 'text-green-600';
    if (stockQty > 10) return 'text-yellow-600';
    return 'text-red-600';
  }
}
