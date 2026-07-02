import { Component, OnInit, ChangeDetectorRef } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { ProductService } from '../../services/product.service';
import { AlertService } from '../../shared/alert.service';

@Component({
  selector: 'app-product',
  standalone: true,
  imports: [CommonModule, FormsModule],
  templateUrl: './product.component.html',
  styleUrls: ['./product.component.css']
})
export class ProductComponent implements OnInit {
  products: any[] = [];
  editingId: number | null = null;
  Math = Math;

  unitTypes = [
    { code: 'PCS', label: 'Piece / Count',  isWeight: false },
    { code: 'KG',  label: 'Kilogram (kg)',  isWeight: true  },
    { code: 'G',   label: 'Gram (g)',       isWeight: true  },
    { code: 'L',   label: 'Litre (L)',      isWeight: true  },
    { code: 'ML',  label: 'Millilitre (mL)',isWeight: true  },
    { code: 'DOZ', label: 'Dozen',          isWeight: false },
    { code: 'BOX', label: 'Box',            isWeight: false },
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

  categories = [
    { id: 1, name: 'Electronics' },
    { id: 2, name: 'Clothing' },
    { id: 3, name: 'Food & Beverages' },
    { id: 4, name: 'Home & Garden' },
    { id: 5, name: 'Books & Media' },
    { id: 6, name: 'Health & Beauty' },
    { id: 7, name: 'Sports & Outdoors' },
    { id: 8, name: 'Toys & Games' },
    { id: 9, name: 'Other' }
  ];

  pageSize = 10;
  currentPage = 1;
  sortBy = 'productName';
  sortOrder: 'asc' | 'desc' = 'asc';
  searchText = '';
  categoryFilter: number | '' = '';

  constructor(
    private productService: ProductService,
    private alertService: AlertService,
    private cdr: ChangeDetectorRef
  ) {}

  ngOnInit(): void {
    this.getAllProducts();
  }

  getCategoryName(categoryId: number): string {
    const category = this.categories.find(c => c.id === categoryId);
    return category ? category.name : 'Unknown';
  }

  validateField(fieldName: string): void {
    const value = (this.productForm as any)[fieldName]?.toString().trim() || '';
    this.validationErrors[fieldName as keyof typeof this.validationErrors] = '';

    switch (fieldName) {
      case 'productName':
        if (!value) {
          this.validationErrors.productName = 'Product name is required';
        } else if (value.length < 2) {
          this.validationErrors.productName = 'Product name must be at least 2 characters';
        } else if (value.length > 100) {
          this.validationErrors.productName = 'Product name must not exceed 100 characters';
        }
        break;
      case 'categoryId':
        if (!value || value === '0') {
          this.validationErrors.categoryId = 'Please select a category';
        }
        break;
      case 'purchasePrice':
        if (!value || value === '' || value === '0') {
          this.validationErrors.purchasePrice = 'Purchase price is required and must be greater than 0';
        } else if (isNaN(Number(value))) {
          this.validationErrors.purchasePrice = 'Purchase price must be a valid number';
        } else if (Number(value) <= 0) {
          this.validationErrors.purchasePrice = 'Purchase price must be greater than 0';
        }
        break;
      case 'salePrice':
        if (!value || value === '' || value === '0') {
          this.validationErrors.salePrice = 'Selling price is required and must be greater than 0';
        } else if (isNaN(Number(value))) {
          this.validationErrors.salePrice = 'Selling price must be a valid number';
        } else if (Number(value) <= 0) {
          this.validationErrors.salePrice = 'Selling price must be greater than 0';
        } else if (Number(value) < Number(this.productForm.purchasePrice)) {
          this.validationErrors.salePrice = 'Selling price cannot be less than purchase price (৳' + Number(this.productForm.purchasePrice).toFixed(2) + ')';
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
        this.alertService.success('Product created successfully!');
        this.resetForm();
        this.getAllProducts();
      },
      error: (err: any) => {
        console.error('Error creating product:', err);
        this.alertService.error('Failed to create product: ' + (err.error?.message || err.message));
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
        this.alertService.success('Product updated successfully!');
        this.resetForm();
        this.editingId = null;
        this.getAllProducts();
      },
      error: (err: any) => {
        console.error('Error updating product:', err);
        this.alertService.error('Failed to update product: ' + (err.error?.message || err.message));
      }
    });
  }

  cancelEdit(): void {
    this.resetForm();
    this.editingId = null;
    this.clearValidationErrors();
  }

  deleteProduct(id: number, name: string): void {
    this.alertService.confirm(`Are you sure you want to delete "${name}"?`).then((confirmed: boolean) => {
      if (confirmed) {
        this.productService.deleteProduct(id).subscribe({
          next: (response: any) => {
            this.alertService.success('Product deleted successfully!');
            this.getAllProducts();
          },
          error: (err: any) => {
            console.error('Error deleting product:', err);
            this.alertService.error('Failed to delete product: ' + (err.error?.message || err.message));
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
        this.alertService.error('Failed to load products: ' + (err.error?.message || err.message));
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
