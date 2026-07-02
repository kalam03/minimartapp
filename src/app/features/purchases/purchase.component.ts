import { Component, HostListener, OnInit, ElementRef, ViewChild } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { ProductService } from '../../services/product.service';
import { Product, ProductFilter } from '../../models/product';
import { FinancialInputComponent } from '../../shared/financial-input.component';
import { AlertService } from '../../shared/alert.service';
import { SupplierService } from '../../services/supplier.service';
import { PurchaseService } from '../../services/purchase.service';
import { Supplier } from '../../models/Supplier';

export interface PurchaseCartItem {
  productId: number;
  product: Product;
  quantity: number;
  unitPrice: number;
  subtotal: number;
}

export interface PurchaseOrder {
  purchaseOrderNo: string;
  supplierName: string;
  totalAmount: number;
  discountAmount: number;
  grossAmount: number;
  paidAmount: number;
  dueAmount: number;
  date: string;
}

@Component({
  selector: 'app-purchase',
  standalone: true,
  imports: [CommonModule, FormsModule, FinancialInputComponent],
  templateUrl: './purchase.component.html',
  styleUrls: ['./purchase.component.css'],
})
export class PurchaseComponent implements OnInit {
  constructor(
    private productService: ProductService,
    private supplierService: SupplierService,
    private alertService: AlertService,
    private purchaseService: PurchaseService,
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
  suppliers: Supplier[] = [];

  // Cart Items
  cartItems: PurchaseCartItem[] = [];

  // Selected IDs
  selectedProductId: number | null = null;
  selectedSupplierId: number | null = null;

  // Quantities
  productQuantity: number = 1;

  // Payment Info
  subtotal: number = 0;
  discountAmount: number = 0;
  discountPercent: number = 0;
  transportCost: number = 0;
  transportType: string = '';
  selectedPaymentMethod: string = 'credit';
  paymentAmount: number = 0;
  returnAmount: number = 0;
  dueAmount: number = 0;
  grossAmount: number = 0;

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
    this.loadSamplePurchaseOrders();
  }

  loadSuppliers(): void {
    this.supplierService.getAllSuppliers().subscribe({
      next: (response: any) => {
        // Handle both plain array and paginated wrapper responses
        this.suppliers = Array.isArray(response)
          ? response
          : (response?.data ?? response?.items ?? response?.suppliers ?? []);
      },
      error: (err: any) => {
        console.error('Error loading suppliers:', err);
      },
    });
  }

  loadProducts(): void {
    this.productService.getAllProducts(this.filters).subscribe({
      next: (data: any) => {
        // Handle both plain array and paginated wrapper responses
        this.products = Array.isArray(data)
          ? data
          : (data?.data ?? data?.items ?? data?.products ?? []);
      },
      error: (err: any) => {
        console.error('Error loading products:', err);
      },
    });
  }

  loadSamplePurchaseOrders(): void {
    // Sample purchase order data
    this.purchaseOrders = [
      {
        purchaseOrderNo: 'PO-001',
        supplierName: 'ABC Suppliers',
        totalAmount: 5000.0,
        discountAmount: 200.0,
        grossAmount: 4800.0,
        paidAmount: 3000.0,
        dueAmount: 1800.0,
        date: new Date().toLocaleDateString(),
      },
      {
        purchaseOrderNo: 'PO-002',
        supplierName: 'XYZ Distributors',
        totalAmount: 7500.0,
        discountAmount: 500.0,
        grossAmount: 7000.0,
        paidAmount: 7000.0,
        dueAmount: 0.0,
        date: new Date().toLocaleDateString(),
      },
    ];
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

  scrollToSelectedProduct(): void {
    setTimeout(() => {
      const selectedElement = document.querySelector('.product-dropdown-item.selected');
      if (selectedElement) {
        selectedElement.scrollIntoView({ block: 'nearest', behavior: 'smooth' });
      }
    }, 0);
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

  selectProduct(product: Product): void {
    this.selectedProduct = product;
    this.selectedProductId = product.productId;
    this.searchProductTerm = product.productName;
    this.showProductDropdown = false;
    this.selectedProductIndex = -1;

    setTimeout(() => {
      const quantityInput = document.querySelector('input[type="number"]') as HTMLInputElement;
      if (quantityInput) {
        quantityInput.focus();
      }
    }, 0);
  }

  selectSupplier(supplier: Supplier): void {
    this.selectedSupplierId = supplier.supplierId;
    this.searchSupplierTerm = supplier.supplierName;
    this.showSupplierDropdown = false;
    this.selectedSupplierIndex = -1;
    this.discountPercent = 0;
    this.calculateTotals();
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
    this.discountPercent = 0;
    this.transportCost = 0;
    this.transportType = '';
    this.selectedPaymentMethod = 'credit';
    this.paymentAmount = 0;
    this.calculateTotals();
  }

  onTransportCostChange(value: string | number): void {
    const numValue = typeof value === 'string' ? parseFloat(value) : value;
    this.transportCost = isNaN(numValue) ? 0 : Math.max(0, numValue);
    this.calculateTotals();
  }

  onTransportTypeChange(value: string): void {
    this.transportType = value;
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

  get filteredProducts(): Product[] {
    if (!this.searchProductTerm || !Array.isArray(this.products)) return [];
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

  get filteredSuppliers(): Supplier[] {
    if (!this.searchSupplierTerm || !Array.isArray(this.suppliers)) return [];
    return this.suppliers
      .filter(
        (supplier) =>
          supplier.supplierName?.toLowerCase().includes(this.searchSupplierTerm.toLowerCase()) ||
          supplier.address?.toLowerCase().includes(this.searchSupplierTerm.toLowerCase()) ||
          supplier.phone?.includes(this.searchSupplierTerm),
      )
      .slice(0, 10);
  }

  get selectedSupplier(): Supplier | undefined {
    if (!Array.isArray(this.suppliers)) return undefined;
    return this.suppliers.find((s) => s.supplierId === this.selectedSupplierId);
  }

  onProductQuantityChange(value: string | number): void {
    const numValue = typeof value === 'string' ? parseInt(value, 10) : value;
    this.productQuantity = isNaN(numValue) ? 1 : Math.max(1, numValue);
  }

  onDiscountPercentChange(value: string | number): void {
    const numValue = typeof value === 'string' ? parseFloat(value) : value;
    this.discountPercent = isNaN(numValue) ? 0 : Math.max(0, Math.min(100, numValue));
    this.calculateTotals();
  }

  onPaymentAmountChange(value: string | number): void {
    const numValue = typeof value === 'string' ? parseFloat(value) : value;
    this.paymentAmount = isNaN(numValue) ? 0 : Math.max(0, numValue);
    this.calculateReturnAndDue();
  }

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
        unitPrice: product.purchasePrice,
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

  removeFromCart(item: PurchaseCartItem): void {
    const index = this.cartItems.indexOf(item);
    if (index > -1) {
      this.cartItems.splice(index, 1);
      this.calculateTotals();
    }
  }

  clearCart(): void {
    if (confirm('Are you sure you want to clear the cart?')) {
      this.cartItems = [];
      this.discountPercent = 0;
      this.calculateTotals();
    }
  }

  calculateTotals(): void {
    this.subtotal = this.cartItems.reduce((sum, item) => sum + item.subtotal, 0);
    this.discountAmount = (this.subtotal * this.discountPercent) / 100;
    this.grossAmount = this.subtotal - this.discountAmount + this.transportCost;

    if (this.grossAmount < 0) {
      this.grossAmount = 0;
    }

    this.calculateReturnAndDue();
  }

  calculateReturnAndDue(): void {
    if (this.paymentAmount >= this.grossAmount) {
      this.returnAmount = this.paymentAmount - this.grossAmount;
      this.dueAmount = 0;
    } else {
      this.returnAmount = 0;
      this.dueAmount = this.grossAmount - this.paymentAmount;
    }
  }

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
      `Are you sure you want to submit the purchase order? Total: $${this.grossAmount.toFixed(2)}`,
      'Confirm Purchase Submission',
    );

    if (confirmed) {
      const newPurchaseOrder: PurchaseOrder = {
        purchaseOrderNo: 'PO-' + Date.now(),
        supplierName: this.selectedSupplier?.supplierName || '',
        totalAmount: this.subtotal,
        discountAmount: this.discountAmount,
        grossAmount: this.grossAmount,
        paidAmount: this.paymentAmount,
        dueAmount: this.dueAmount,
        date: new Date().toLocaleDateString(),
      };

      const purchaseData = {
        purchaseOrderNo: newPurchaseOrder.purchaseOrderNo,
        purchaseDate: new Date(),
        supplierId: this.selectedSupplier?.supplierId,
        totalAmount: this.subtotal,
        discount: this.discountAmount,
        discountPercent: this.discountPercent,
        transportCost: this.transportCost,
        transport: this.transportType,
        netAmount: this.grossAmount,
        paymentType: this.selectedPaymentMethod,
        paidAmount: this.paymentAmount,
        remarks: 'new purchases added',
        PaymentMethod: this.selectedPaymentMethod,
        PaymentReferenceNo: newPurchaseOrder.purchaseOrderNo,
        returnAmount: this.returnAmount,
        dueAmount: this.dueAmount,
        items: this.cartItems.map((item) => ({
          productId: item.product.productId,
          quantity: Number(item.quantity),
          unitCostPrice: Number(item.unitPrice),
        })),
      };

      console.log('Submitting purchase:', purchaseData);

      this.purchaseService.createPurchase(purchaseData).subscribe({
        next: async (response: any) => {
          await this.alertService.success(
            `Purchase Order Submitted Successfully!\nPO: ${response.purchaseOrderNo || newPurchaseOrder.purchaseOrderNo}`,
          );
          this.purchaseOrders.unshift(newPurchaseOrder);
          this.resetForm();
        },
        error: (error) => {
          console.error('Error recording purchase:', error);
          this.alertService.error(
            'Error submitting purchase order',
            error.message ||
              'An error occurred while submitting the purchase order. Please try again.',
          );
        },
      });
    }
  }

  onQuantityKeydown(event: KeyboardEvent): void {
    if (event.key === 'Tab') {
      event.preventDefault();
      this.addToCart();
    }
  }

  async viewPurchaseOrder(order: PurchaseOrder): Promise<void> {
    await this.alertService.info(
      `Purchase Order Details:\nPO: ${order.purchaseOrderNo}\nSupplier: ${order.supplierName}\nTotal: $${order.totalAmount}\nDiscount: $${order.discountAmount}\nGross: $${order.grossAmount}\nPaid: $${order.paidAmount}\nDue: $${order.dueAmount}\nDate: ${order.date}`,
    );
  }

  printPurchaseOrder(order: PurchaseOrder): void {
    const printWindow = window.open('', '', 'width=300,height=600');

    printWindow?.document.write(`
    <pre>
Lucky Shop BD
Invoice: 1001
Milk x2 = 160
Total: 160 Tk 
Thank You
    </pre>
  `);

    printWindow?.document.close();
    printWindow?.print();
  }
}
