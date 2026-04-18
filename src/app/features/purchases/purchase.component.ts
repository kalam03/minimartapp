import { Component, HostListener, OnInit, ElementRef, ViewChild } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { ProductService } from '../../services/product.service';
import { Product, ProductFilter } from '../../models/product';
import { AlertService } from '../../shared/alert.service';
// import { Supplier, SupplierFilter, SupplierService } from '../../services/supplier.service';
import { PurchaseService } from '../../services/purchase.service';

export interface CartItem {
  productId: number;
  product: Product;
  quantity: number;
  costPrice: number;
  subtotal: number;
}

export interface PurchaseOrder {
  purchaseOrderNo: string;
  supplierName: string;
  totalAmount: number;
  date: string;
  itemsCount: number;
}

@Component({
  selector: 'app-purchase',
  standalone: true,
  imports: [CommonModule, FormsModule],
  templateUrl: './purchase.component.html',
  styleUrls: ['./purchase.component.css'],
})
export class PurchaseComponent implements OnInit {
  constructor(
    private productService: ProductService,
    //private supplierService: SupplierService,
    private alertService: AlertService,
    private purchaseService: PurchaseService
  ) {}
  Math = Math;

  // ViewChild references for input elements
  @ViewChild('productSearchInput') productSearchInput!: ElementRef;
  @ViewChild('supplierSearchInput') supplierSearchInput!: ElementRef;
  @ViewChild('quantityInput') quantityInput!: ElementRef;

  // UI State
  showProductDropdown: boolean = false;
  showSupplierDropdown: boolean = false;

  // Keyboard navigation indices
  selectedProductIndex: number = -1;
  selectedSupplierIndex: number = -1;

  // Products Data
  products: Product[] = [];

  // Selected Product
  selectedProduct: Product | null = null;

  // Suppliers Data
  suppliers: any[] = [];

  // Cart Items
  cartItems: CartItem[] = [];

  // Selected IDs
  selectedProductId: number | null = null;
  selectedSupplierId: number | null = null;

  // Quantities
  productQuantity: number = 1;

  // Purchase Info
  subtotal: number = 0;

  // UI State
  searchProductTerm: string = '';
  searchSupplierTerm: string = '';

  // Purchase Order History
  purchaseOrders: PurchaseOrder[] = [];

  filters: ProductFilter = {
    tenantId: null,
    isActive: true,
    categoryId: null,
  };

  ngOnInit(): void {
    this.loadProducts();
    this.loadSuppliers();
    this.loadPurchaseOrders();
  }

  loadSuppliers(): void {
    // let supplierFilters: SupplierFilter = {
    //   tenantId: 1,
    // };
    // this.supplierService.getAllSuppliers(supplierFilters).subscribe({
    //   next: (data:any) => {
    //     this.suppliers = data;
    //   },
    //   error: (err: any) => {
    //     console.error('Error loading suppliers:', err);
    //   },
    // });
  }

  loadProducts(): void {
    this.productService.getAllProducts(this.filters).subscribe({
      next: (data) => {
        this.products = data;
      },
      error: (err: any) => {
        console.error('Error loading products:', err);
      },
    });
  }

  loadPurchaseOrders(): void {
    this.purchaseService.getPurchases().subscribe({
      next: (res: any) => {
        if (res && res.data) {
          this.purchaseOrders = res.data;
        } else {
          this.purchaseOrders = [];
        }
      },
      error: (err: any) => {
        console.error('Error loading purchase orders:', err);
        this.purchaseOrders = [];
      },
    });
  }

  onProductSearch(term: string): void {
    this.searchProductTerm = term;
    this.showProductDropdown = term.length > 0;
    this.selectedProductIndex = -1;

    if (term.length > 0 && this.filteredProducts.length > 0) {
      const exactMatch = this.filteredProducts.find(
        (product) => product.productName?.toLowerCase() === term.toLowerCase(),
      );

      if (exactMatch) {
        this.selectProduct(exactMatch);
      }
    }
  }

  onProductKeydown(event: KeyboardEvent): void {
    if (!this.showProductDropdown || this.filteredProducts.length === 0) {
      if (event.key === 'Enter' && this.searchProductTerm.length > 0) {
        event.preventDefault();
        this.selectBestMatchProduct();
      }
      return;
    }

    switch (event.key) {
      case 'ArrowDown':
        event.preventDefault();
        this.selectedProductIndex = Math.min(
          this.selectedProductIndex + 1,
          this.filteredProducts.length - 1,
        );
        this.scrollToSelectedProduct();
        break;

      case 'ArrowUp':
        event.preventDefault();
        this.selectedProductIndex = Math.max(this.selectedProductIndex - 1, -1);
        this.scrollToSelectedProduct();
        break;

      case 'Enter':
        event.preventDefault();
        if (
          this.selectedProductIndex >= 0 &&
          this.selectedProductIndex < this.filteredProducts.length
        ) {
          this.selectProduct(this.filteredProducts[this.selectedProductIndex]);
        } else if (this.filteredProducts.length > 0) {
          this.selectProduct(this.filteredProducts[0]);
        }
        break;

      case 'Escape':
        event.preventDefault();
        this.showProductDropdown = false;
        this.selectedProductIndex = -1;
        break;
    }
  }

  onSupplierSearch(term: string): void {
    this.searchSupplierTerm = term;
    this.showSupplierDropdown = term.length > 0;
    this.selectedSupplierIndex = -1;

    if (term.length > 0 && this.filteredSuppliers.length > 0) {
      const exactMatch = this.filteredSuppliers.find(
        (supplier) =>
          supplier.supplierName?.toLowerCase() === term.toLowerCase() || supplier.phone === term,
      );

      if (exactMatch) {
        this.selectSupplier(exactMatch);
      }
    }
  }

  onSupplierKeydown(event: KeyboardEvent): void {
    if (!this.showSupplierDropdown || this.filteredSuppliers.length === 0) {
      if (event.key === 'Enter' && this.searchSupplierTerm.length > 0) {
        event.preventDefault();
        this.selectBestMatchSupplier();
      }
      return;
    }

    switch (event.key) {
      case 'ArrowDown':
        event.preventDefault();
        this.selectedSupplierIndex = Math.min(
          this.selectedSupplierIndex + 1,
          this.filteredSuppliers.length - 1,
        );
        this.scrollToSelectedSupplier();
        break;

      case 'ArrowUp':
        event.preventDefault();
        this.selectedSupplierIndex = Math.max(this.selectedSupplierIndex - 1, -1);
        this.scrollToSelectedSupplier();
        break;

      case 'Enter':
        event.preventDefault();
        if (
          this.selectedSupplierIndex >= 0 &&
          this.selectedSupplierIndex < this.filteredSuppliers.length
        ) {
          this.selectSupplier(this.filteredSuppliers[this.selectedSupplierIndex]);
        } else if (this.filteredSuppliers.length > 0) {
          this.selectSupplier(this.filteredSuppliers[0]);
        }
        break;

      case 'Escape':
        event.preventDefault();
        this.showSupplierDropdown = false;
        this.selectedSupplierIndex = -1;
        break;
    }
  }

  scrollToSelectedSupplier(): void {
    setTimeout(() => {
      const selectedElement = document.querySelector('.supplier-dropdown-item.selected');
      if (selectedElement) {
        selectedElement.scrollIntoView({ block: 'nearest', behavior: 'smooth' });
      }
    }, 0);
  }

  selectBestMatchProduct(): void {
    if (this.searchProductTerm.length === 0) return;

    const term = this.searchProductTerm.toLowerCase();

    let bestMatch = this.products.find((product) => product.productName?.toLowerCase() === term);

    if (!bestMatch) {
      bestMatch = this.products.find((product) =>
        product.productName?.toLowerCase().startsWith(term),
      );
    }

    if (!bestMatch) {
      bestMatch = this.products.find((product) =>
        product.productName?.toLowerCase().includes(term),
      );
    }

    if (bestMatch) {
      this.selectProduct(bestMatch);
    }
  }

  selectBestMatchSupplier(): void {
    if (this.searchSupplierTerm.length === 0) return;

    const term = this.searchSupplierTerm.toLowerCase();

    let bestMatch = this.suppliers.find(
      (supplier) =>
        supplier.supplierName?.toLowerCase() === term || supplier.phone === this.searchSupplierTerm,
    );

    if (!bestMatch) {
      bestMatch = this.suppliers.find((supplier) =>
        supplier.supplierName?.toLowerCase().startsWith(term),
      );
    }

    if (!bestMatch) {
      bestMatch = this.suppliers.find((supplier) =>
        supplier.supplierName?.toLowerCase().includes(term),
      );
    }

    if (bestMatch) {
      this.selectSupplier(bestMatch);
    }
  }

  scrollToSelectedProduct(): void {
    setTimeout(() => {
      const selectedElement = document.querySelector('.product-dropdown-item.selected');
      if (selectedElement) {
        selectedElement.scrollIntoView({ block: 'nearest', behavior: 'smooth' });
      }
    }, 0);
  }

  selectProduct(product: Product): void {
    this.selectedProduct = product;
    this.selectedProductId = product.productId;
    this.searchProductTerm = product.productName;
    this.showProductDropdown = false;
    this.selectedProductIndex = -1;

    setTimeout(() => {
      if (this.quantityInput) {
        this.quantityInput.nativeElement.focus();
      }
    }, 0);
  }

  selectSupplier(supplier: any): void {
    this.selectedSupplierId = supplier.supplierId;
    this.searchSupplierTerm = supplier.supplierName;
    this.showSupplierDropdown = false;
    this.selectedSupplierIndex = -1;
  }

  resetProduct(): void {
    this.selectedProduct = null;
    this.selectedProductId = null;
    this.searchProductTerm = '';
    this.productQuantity = 1;
    this.showProductDropdown = false;
    this.selectedProductIndex = -1;
  }

  resetForm(): void {
    this.cartItems = [];
    this.selectedSupplierId = null;
    this.searchSupplierTerm = '';
    this.calculateTotals();
  }

  @HostListener('document:click', ['$event'])
  onClickOutside(event: Event): void {
    const target = event.target as HTMLElement;
    if (!target.closest('.product-search-container')) {
      this.showProductDropdown = false;
      this.selectedProductIndex = -1;
    }
    if (!target.closest('.supplier-search-container')) {
      this.showSupplierDropdown = false;
      this.selectedSupplierIndex = -1;
    }
  }

  // Filtered Products
  get filteredProducts(): Product[] {
    if (!this.searchProductTerm) return [];
    const term = this.searchProductTerm.toLowerCase();
    return this.products
      .filter(
        (product) =>
          product.productName?.toLowerCase().includes(term) ||
          product.categoryName?.toLowerCase().includes(term) ||
          product.barcode?.toLowerCase().includes(term),
      )
      .slice(0, 10);
  }

  // Filtered Suppliers
  get filteredSuppliers(): any[] {
    if (!this.searchSupplierTerm) return [];
    return this.suppliers
      .filter(
        (supplier) =>
          supplier.supplierName?.toLowerCase().includes(this.searchSupplierTerm.toLowerCase()) ||
          supplier.address?.toLowerCase().includes(this.searchSupplierTerm.toLowerCase()) ||
          supplier.phone?.includes(this.searchSupplierTerm),
      )
      .slice(0, 10);
  }

  // Get Selected Supplier
  get selectedSupplier(): any | undefined {
    return this.suppliers.find((s) => s.supplierId === this.selectedSupplierId);
  }

  // Helper method for product quantity
  onProductQuantityChange(value: string | number): void {
    const numValue = typeof value === 'string' ? parseInt(value, 10) : value;
    this.productQuantity = isNaN(numValue) ? 1 : Math.max(1, numValue);
  }

  // Add Product to Cart
  async addToCart() {
    if (!this.selectedProduct) {
      this.alertService.info('Please select a product to add to the cart.', 'No Product Selected');
      setTimeout(() => {
        if (this.productSearchInput) {
          this.productSearchInput.nativeElement.focus();
        }
      }, 0);
      return;
    }

    const product = this.selectedProduct;

    const existingItem = this.cartItems.find(
      (item) => item.product.productId === product.productId,
    );

    if (existingItem) {
      existingItem.quantity += this.productQuantity;
      existingItem.subtotal = existingItem.quantity * product.purchasePrice;
    } else {
      this.cartItems.push({
        productId: product.productId,
        product: product,
        quantity: this.productQuantity,
        costPrice: product.purchasePrice,
        subtotal: this.productQuantity * product.purchasePrice,
      });
    }

    this.calculateTotals();
    this.resetProduct();

    setTimeout(() => {
      if (this.productSearchInput) {
        this.productSearchInput.nativeElement.focus();
      }
    }, 0);
  }

  // Remove from Cart
  removeFromCart(item: CartItem): void {
    const index = this.cartItems.indexOf(item);
    if (index > -1) {
      this.cartItems.splice(index, 1);
      this.calculateTotals();
    }
  }

  // Clear Cart
  clearCart(): void {
    if (confirm('Are you sure you want to clear the cart?')) {
      this.cartItems = [];
      this.calculateTotals();
    }
  }

  // Calculate Totals
  calculateTotals(): void {
    this.subtotal = this.cartItems.reduce((sum, item) => sum + item.subtotal, 0);
  }

  // Submit Purchase Order
  async submitPurchase() {
    if (this.cartItems.length === 0) {
      await this.alertService.warning('Cart is empty. Please add items to continue.');
      return;
    }

    if (!this.selectedSupplierId) {
      await this.alertService.warning('Please select a supplier.');
      return;
    }

    const confirmed = await this.alertService.confirm(
      `Are you sure you want to submit the purchase order? Total: ৳${this.subtotal.toFixed(2)}`,
      'Confirm Purchase',
    );
    
    if (confirmed) {
      const purchaseData = {
        supplierId: this.selectedSupplierId,
        purchaseDate: new Date(),
        totalAmount: this.subtotal,
        items: this.cartItems.map(item => ({
          productId: item.product.productId,
          quantity: item.quantity,
          costPrice: item.costPrice
        }))
      };

      this.purchaseService.createPurchase(purchaseData).subscribe({
        next: async (response: any) => {
          await this.alertService.success(`Purchase Order Created Successfully!\nPO No: ${response.purchaseOrderNo || 'PO-' + Date.now()}`);
          this.resetForm();
          this.loadPurchaseOrders();
        },
        error: (error) => {
          console.error('Error creating purchase:', error);
          this.alertService.error('Error creating purchase order', error.message || 'An error occurred while creating the purchase order.');
        }
      });
    }
  }

  // Add this method to handle Tab key on quantity input
  onQuantityKeydown(event: KeyboardEvent): void {
    if (event.key === 'Tab') {
      event.preventDefault();
      this.addToCart();
    }
  }

  // View purchase order details
  async viewPurchaseOrder(order: PurchaseOrder): Promise<void> {
    await this.alertService.info(
      `Purchase Order Details:\nPO No: ${order.purchaseOrderNo}\nSupplier: ${order.supplierName}\nTotal: ৳${order.totalAmount.toFixed(2)}\nItems: ${order.itemsCount}\nDate: ${order.date}`,
    );
  }

  // Print purchase order
  printPurchaseOrder(order: PurchaseOrder): void {
    console.log('Printing purchase order:', order);
    window.print();
  }
}