import { Component, HostListener, OnInit, ElementRef, ViewChild } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { ActivatedRoute, Router } from '@angular/router';
import { ProductService } from '../../services/product.service';
import { Product, ProductFilter } from '../../models/product';
import { FinancialInputComponent } from '../../shared/financial-input.component';
import { AlertService } from '../../shared/alert.service';
import { Customer, CustomerFilter, CustomerService } from '../../services/customer.service';
import { SaleService, StockConflictError } from '../../services/sale.service';
import { ReceiptService, ReceiptData, ReceiptItem } from '../../services/receipt.service';
import { OrderService } from '../../services/order.service';


export interface CartItem {
  productId: number;
  product: Product;
  quantity: number;
  unitPrice: number;
  subtotal: number;
}

export interface Invoice {
  invoiceNo: string;
  customerName: string;
  totalAmount: number;
  discountAmount: number;
  grossAmount: number;
  date: string;
}

@Component({
  selector: 'app-pos-billing',
  standalone: true,
  imports: [CommonModule, FormsModule, FinancialInputComponent],
  // Note: ActivatedRoute + Router are injected but not imported here (they're provided by the router module)
  templateUrl: './pos-billing.html',
  styleUrls: ['./pos-billing.css'],
})
export class PosBillingComponent implements OnInit {
  constructor(
    private productService: ProductService,
    private customerService: CustomerService,
    private alertService: AlertService,
    private saleService: SaleService,
    private receiptService: ReceiptService,
    private orderService: OrderService,
    private route: ActivatedRoute,
    private router: Router
  ) {
    this.receiptData = this.receiptService.getReceiptData();
  }

  /** When opened from Order List, this holds the active order id */
  activeOrderId: number | null = null;
  orderLoading = false;
  Math = Math;
 @ViewChild('receiptContainer') receiptContainer!: ElementRef;
  
  receiptData: ReceiptData;
  receiptHTML: string = '';
  // ViewChild references for input elements
  @ViewChild('productSearchInput') productSearchInput!: ElementRef;
  @ViewChild('customerSearchInput') customerSearchInput!: ElementRef;
  @ViewChild('quantityInput') quantityInput!: ElementRef;

  // UI State
  showProductDropdown: boolean = false;
  showCustomerDropdown: boolean = false;

  // Keyboard navigation indices
  selectedProductIndex: number = -1;
  selectedCustomerIndex: number = -1;

  // Products Data
  products: Product[] = [];

  // Selected Product
  selectedProduct: Product | null = null;

  // Customers Data
  customers: Customer[] = [];

  // Cart Items
  cartItems: CartItem[] = [];
  /** Product IDs that failed with a stock conflict on the last finalization attempt */
  conflictProductIds = new Set<number>();

  // Selected IDs
  selectedProductId: number | null = null;
  selectedCustomerId: number | null = null;

  // Quantities
  productQuantity: number = 1;

  // Payment Info
  subtotal: number = 0;
  discountAmount: number = 0;
  discountPercent: number = 0;
  transportCost: number = 0;
  transportType: string = '';
  selectedPaymentMethod: string = 'cash';
  paymentCash: number = 0;
  returnCash: number = 0;
  dueAmount: number = 0;
  grossAmount: number = 0;

  // UI State
  searchProductTerm: string = '';
  searchCustomerTerm: string = '';
  customerPhone: string = '';

  // Invoice History
  invoices: Invoice[] = [];

  filters: ProductFilter = {
    tenantId: null,
    isActive: true,
    categoryId: null,
  };

  ngOnInit(): void {
    this.loadProducts();
    this.loadCustomers();
    this.loadSampleInvoices();

    // Check if opened from Order Management
    this.route.queryParams.subscribe(params => {
      const orderId = params['orderId'];
      if (orderId) {
        this.activeOrderId = +orderId;
        this.loadOrderIntoCart(+orderId);
      }
    });
  }

  /** Load a saved order's items into the POS cart */
  loadOrderIntoCart(orderId: number): void {
    this.orderLoading = true;
    // Mark order as Processing so it's visible on the list
    this.orderService.updateOrderStatus(orderId, { status: 'Processing' }).subscribe();

    this.orderService.getOrderById(orderId).subscribe({
      next: res => {
        const order = res?.data;
        if (!order) { this.orderLoading = false; return; }

        // Wait until products are loaded, then build cart
        const tryLoad = () => {
          if (this.products.length === 0) { setTimeout(tryLoad, 200); return; }

          this.cartItems = [];
          order.items.forEach(item => {
            const product = this.products.find(p => p.productId === item.productId);
            if (product) {
              this.cartItems.push({
                productId: item.productId,
                product:   product,
                quantity:  item.quantity,
                unitPrice: item.unitPrice,
                subtotal:  item.total
              });
            } else {
              // Product not found in list — create a minimal placeholder
              const placeholder: Product = {
                productId:          item.productId,
                productName:        item.productName,
                unitType:           item.unitType,
                salePrice:          item.unitPrice,
                purchasePrice:      item.unitPrice,
                stockQty:           999,
                barcode:            '',
                categoryId:         0,
                categoryName:       '',
                isActive:           true,
                tenantId:           0,
                tenantName:         '',
                totalStockValue:    0,
                profitMarginPercent:0,
                stockStatus:        'In Stock',
                retrievedDate:      new Date()
              };
              this.cartItems.push({
                productId: item.productId,
                product:   placeholder,
                quantity:  item.quantity,
                unitPrice: item.unitPrice,
                subtotal:  item.total
              });
            }
          });

          // Pre-fill transport from order
          this.transportCost = order.transport || 0;

          // Convert absolute discount → percentage so calculateTotals() works correctly
          const orderSubtotal = order.items.reduce((s, i) => s + i.total, 0);
          this.discountPercent = orderSubtotal > 0
            ? +((( order.discount || 0) / orderSubtotal) * 100).toFixed(4)
            : 0;

          // Recalculate all totals from the loaded cart
          this.calculateTotals();

          // Pre-fill customer name and phone from order
          if (order.customerName) {
            this.searchCustomerTerm = order.customerName;
            // Try to match against loaded customers list
            const match = this.customers.find(
              c => c.customerName?.toLowerCase() === order.customerName?.toLowerCase()
                || (order.customerPhone && c.phone === order.customerPhone)
            );
            if (match) {
              this.selectedCustomerId = match.customerId;
              this.customerPhone      = match.phone || order.customerPhone || '';
            } else {
              this.selectedCustomerId = null;
              this.customerPhone      = order.customerPhone || '';
            }
          } else if (order.customerPhone) {
            this.customerPhone = order.customerPhone;
          }

          this.orderLoading = false;
          this.alertService.info(
            `Order #${orderId} loaded — ${order.items.length} item(s)\nCustomer: ${order.customerName || 'Walk-in'}`,
            'Order Loaded'
          );
        };
        tryLoad();
      },
      error: () => { this.orderLoading = false; }
    });
  }

  loadCustomers(): void {
    let Custfilters: CustomerFilter = {
      tenantId: 1,
    };
    this.customerService.getAllCustomers(Custfilters).subscribe({
      next: (data: any) => {
        // API may return a paginated wrapper object instead of a plain array
        this.customers = Array.isArray(data)
          ? data
          : (data?.data ?? data?.items ?? data?.customers ?? []);
      },
      error: (err: any) => {
        console.error('Error loading customers:', err);
      },
    });
  }

  loadProducts(): void {
    this.productService.getAllProducts(this.filters).subscribe({
      next: (data: any) => {
        // API may return a paginated wrapper object instead of a plain array
        this.products = Array.isArray(data)
          ? data
          : (data?.data ?? data?.items ?? data?.products ?? []);
      },
      error: (err: any) => {
        console.error('Error loading products:', err);
      },
    });
  }

  loadSampleInvoices(): void {
    // Sample invoice data
    this.invoices = [
      {
        invoiceNo: 'INV-001',
        customerName: 'John Doe',
        totalAmount: 150.0,
        discountAmount: 10.0,
        grossAmount: 140.0,
        date: new Date().toLocaleDateString(),
      },
      {
        invoiceNo: 'INV-002',
        customerName: 'Jane Smith',
        totalAmount: 250.0,
        discountAmount: 25.0,
        grossAmount: 225.0,
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

  onCustomerSearch(term: string): void {
    this.searchCustomerTerm = term;
    this.showCustomerDropdown = term.length > 0;
    this.selectedCustomerIndex = -1;

    // If search cleared, deselect customer and recalculate (removes previousDue)
    if (!term) {
      this.selectedCustomerId = null;
      this.customerPhone = '';
      this.calculateTotals();
    }

    if (term.length > 0 && this.filteredCustomers.length > 0) {
      const exactMatch = this.filteredCustomers.find(
        (customer) =>
          customer.customerName?.toLowerCase() === term.toLowerCase() || customer.phone === term,
      );

      if (exactMatch) {
        this.selectCustomer(exactMatch);
      }
    }
  }

  // Update the onCustomerKeydown method
  onCustomerKeydown(event: KeyboardEvent): void {
    console.log(
      'Key pressed:',
      event.key,
      'Dropdown visible:',
      this.showCustomerDropdown,
      'Filtered count:',
      this.filteredCustomers.length,
    );

    if (!this.showCustomerDropdown || this.filteredCustomers.length === 0) {
      if (event.key === 'Enter' && this.searchCustomerTerm.length > 0) {
        event.preventDefault();
        this.selectBestMatchCustomer();
      }
      return;
    }

    switch (event.key) {
      case 'ArrowDown':
        event.preventDefault();
        this.selectedCustomerIndex = Math.min(
          this.selectedCustomerIndex + 1,
          this.filteredCustomers.length - 1,
        );
        console.log('Selected index:', this.selectedCustomerIndex);
        this.scrollToSelectedCustomer();
        break;

      case 'ArrowUp':
        event.preventDefault();
        this.selectedCustomerIndex = Math.max(this.selectedCustomerIndex - 1, -1);
        console.log('Selected index:', this.selectedCustomerIndex);
        this.scrollToSelectedCustomer();
        break;

      case 'Enter':
        event.preventDefault();
        if (
          this.selectedCustomerIndex >= 0 &&
          this.selectedCustomerIndex < this.filteredCustomers.length
        ) {
          this.selectCustomer(this.filteredCustomers[this.selectedCustomerIndex]);
        } else if (this.filteredCustomers.length > 0) {
          this.selectCustomer(this.filteredCustomers[0]);
        }
        break;

      case 'Escape':
        event.preventDefault();
        this.showCustomerDropdown = false;
        this.selectedCustomerIndex = -1;
        break;
    }
  }

  // Add the scrollToSelectedCustomer method
  scrollToSelectedCustomer(): void {
    setTimeout(() => {
      const selectedElement = document.querySelector('.customer-dropdown-item.selected');
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

  selectBestMatchCustomer(): void {
    if (this.searchCustomerTerm.length === 0) return;

    const term = this.searchCustomerTerm.toLowerCase();

    let bestMatch = this.customers.find(
      (customer) =>
        customer.customerName?.toLowerCase() === term || customer.phone === this.searchCustomerTerm,
    );

    if (!bestMatch) {
      bestMatch = this.customers.find((customer) =>
        customer.customerName?.toLowerCase().startsWith(term),
      );
    }

    if (!bestMatch) {
      bestMatch = this.customers.find((customer) =>
        customer.customerName?.toLowerCase().includes(term),
      );
    }

    if (bestMatch) {
      this.selectCustomer(bestMatch);
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
      const quantityInput = document.querySelector('input[type="number"]') as HTMLInputElement;
      if (quantityInput) {
        quantityInput.focus();
      }
    }, 0);
  }

  selectCustomer(customer: Customer): void {
    this.selectedCustomerId = customer.customerId;
    this.searchCustomerTerm = customer.customerName;
    this.customerPhone = customer.phone || '';
    this.showCustomerDropdown = false;
    this.selectedCustomerIndex = -1;
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

  /** Highlights the conflicting cart item in red and auto-clears after 8 s */
  markConflictItem(productId: number): void {
    this.conflictProductIds.add(productId);
    setTimeout(() => {
      this.conflictProductIds.delete(productId);
    }, 8000);
  }

  resetForm(): void {
    this.conflictProductIds.clear();
    this.cartItems = [];
    this.selectedCustomerId = null;
    this.searchCustomerTerm = '';
    this.customerPhone = '';
    this.discountPercent = 0;
    this.transportCost = 0;
    this.transportType = '';
    this.selectedPaymentMethod = 'cash';
    this.paymentCash = 0;
    this.calculateTotals();
  }

  // Handle transport cost changes
  onTransportCostChange(value: string | number): void {
    const numValue = typeof value === 'string' ? parseFloat(value) : value;
    this.transportCost = isNaN(numValue) ? 0 : Math.max(0, numValue);
    this.calculateTotals();
  }

  // Handle transport type changes
  onTransportTypeChange(value: string): void {
    this.transportType = value;
    // Optional: Set predefined transport costs based on type
    switch (value) {
      case 'delivery':
        // this.transportCost = 50; // Uncomment to set default delivery charge
        break;
      case 'courier':
        // this.transportCost = 30; // Uncomment to set default courier charge
        break;
      case 'pickup':
        // this.transportCost = 0; // Uncomment to set zero for pickup
        break;
    }
    this.calculateTotals();
  }

  @HostListener('document:click', ['$event'])
  onClickOutside(event: Event): void {
    const target = event.target as HTMLElement;
    if (!target.closest('.product-search-container')) {
      this.showProductDropdown = false;
      this.selectedProductIndex = -1;
    }
    if (!target.closest('.customer-search-container')) {
      this.showCustomerDropdown = false;
      this.selectedCustomerIndex = -1;
    }
  }

  // Filtered Products
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

  // Filtered Customers
  get filteredCustomers(): Customer[] {
    if (!this.searchCustomerTerm || !Array.isArray(this.customers)) return [];
    const term = this.searchCustomerTerm.toLowerCase();
    return this.customers
      .filter(
        (customer) =>
          customer.customerName?.toLowerCase().includes(term) ||
          customer.address?.toLowerCase().includes(term) ||
          customer.phone?.includes(this.searchCustomerTerm),
      )
      .slice(0, 10);
  }

  // Get Selected Customer
  get selectedCustomer(): Customer | undefined {
    if (!Array.isArray(this.customers)) return undefined;
    return this.customers.find((c) => c.customerId === this.selectedCustomerId);
  }

  /** Previous balance: positive = customer owes (due), negative = customer has credit */
  get previousDue(): number {
    return this.selectedCustomer?.currentBalance || 0;
  }

  // Helper method for product quantity
  onProductQuantityChange(value: string | number): void {
    const numValue = typeof value === 'string' ? parseFloat(value) : value;
    const min = this.isWeightProduct ? 0.001 : 1;
    this.productQuantity = isNaN(numValue) ? min : Math.max(min, numValue);
  }

  /** True when selected product is sold by weight/volume (KG, G, L, ML) */
  get isWeightProduct(): boolean {
    const wt = ['KG', 'G', 'L', 'ML'];
    return !!this.selectedProduct && wt.includes((this.selectedProduct.unitType || '').toUpperCase());
  }

  /** Input step and display unit for the quantity field */
  get qtyStep(): string { return this.isWeightProduct ? '0.001' : '1'; }
  get qtyUnit(): string { return this.selectedProduct?.unitType || 'PCS'; }

  // Helper method for discount percent
  onDiscountPercentChange(value: string | number): void {
    const numValue = typeof value === 'string' ? parseFloat(value) : value;
    this.discountPercent = isNaN(numValue) ? 0 : Math.max(0, Math.min(100, numValue));
    this.calculateTotals();
  }

  // Helper method for payment cash
  onPaymentCashChange(value: string | number): void {
    const numValue = typeof value === 'string' ? parseFloat(value) : value;
    this.paymentCash = isNaN(numValue) ? 0 : Math.max(0, numValue);
    this.calculateReturnAndDue();
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

    if (this.productQuantity > product.stockQty) {
      await this.alertService.warning(`Only ${product.stockQty} items available in stock`);
      return;
    }

    const existingItem = this.cartItems.find(
      (item) => item.product.productId === product.productId,
    );

    if (existingItem) {
      const newQuantity = existingItem.quantity + this.productQuantity;
      if (newQuantity > product.stockQty) {
        await this.alertService.warning(`Only ${product.stockQty} items available in stock`);
        return;
      }
      existingItem.quantity = newQuantity;
      existingItem.subtotal = existingItem.quantity * product.salePrice;
    } else {
      this.cartItems.push({
        productId: product.productId,
        product: product,
        quantity: this.productQuantity,
        unitPrice: product.salePrice,
        subtotal: this.productQuantity * product.salePrice,
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
      this.discountPercent = 0;
      this.calculateTotals();
    }
  }

  // Calculate Totals
  calculateTotals(): void {
    // Calculate subtotal
    this.subtotal = this.cartItems.reduce((sum, item) => sum + item.subtotal, 0);

    // Calculate discount amount based on percentage
    this.discountAmount = (this.subtotal * this.discountPercent) / 100;

    // Sale net = items - discount + transport (before adding previous customer balance)
    const saleNet = this.subtotal - this.discountAmount + this.transportCost;

    // Gross = saleNet + previousDue (positive due adds, negative credit deducts)
    this.grossAmount = saleNet + this.previousDue;

    // Ensure gross amount is not negative
    if (this.grossAmount < 0) {
      this.grossAmount = 0;
    }

    // Calculate return and due
    this.calculateReturnAndDue();
  }

  calculateReturnAndDue(): void {
    if (this.paymentCash >= this.grossAmount) {
      this.returnCash = this.paymentCash - this.grossAmount;
      this.dueAmount = 0;
    } else {
      this.returnCash = 0;
      this.dueAmount = this.grossAmount - this.paymentCash;
    }
  }

  // Submit Bill
  async submitBill() {
    if (this.cartItems.length === 0) {
      await this.alertService.warning('Cart is empty. Please add items to continue.');
      return;
    }
    console.log("customer ",this.selectedCustomer)
    console.log("customerq2 ",this.customers)
    // if (!this.selectedCustomerId) {
    //   await this.alertService.warning('Please select a customer.');
    //   return;
    // }

    // if (this.dueAmount > 0) {
    //   await this.alertService.warning(
    //     `Warning: There is an outstanding due of $${this.dueAmount.toFixed(2)}. Please collect full payment.`,
    //   );
    //   return;
    // }

    // if (this.paymentCash < this.grossAmount) {
    //   await this.alertService.warning(
    //     `Insufficient payment. Please pay $${this.grossAmount.toFixed(2)} or more.`,
    //   );
    //   return;
    // }
    const confirmed = await this.alertService.confirm(
      `Are you sure you want to submit the bill? Total: $${this.grossAmount.toFixed(2)}`,
      'Confirm Bill Submission',
    );
    if (confirmed) {
      const newInvoice: Invoice = {
        invoiceNo: 'INV-' + Date.now(),
        customerName: this.selectedCustomer?.customerName || '',
        totalAmount: this.subtotal,
        discountAmount: this.discountAmount,
        grossAmount: this.grossAmount,
        date: new Date().toLocaleDateString(),
      };


      const saleNet = this.subtotal - this.discountAmount + this.transportCost;

      // Capture before resetForm() clears them
      const snapCustomerId  = this.selectedCustomerId;
      const snapDueAmount   = this.dueAmount;
      const snapPreviousDue = this.previousDue;

      const receipt = {
        invoiceNo: newInvoice.invoiceNo,
        saleDate: new Date(),
        customerId: this.selectedCustomer?.customerId,
        customerName: this.selectedCustomer?.customerName || this.searchCustomerTerm || '',
        customerPhone: this.customerPhone,
        totalAmount: this.subtotal,
        discount: this.discountAmount,
        discountPercent: this.discountPercent,
        transportCost: this.transportCost,
        transport: this.transportType,
        previousDue: this.previousDue,
        netAmount: this.grossAmount,
        paymentType: this.selectedPaymentMethod,
        paidAmount: this.paymentCash,
        returnAmount: this.returnCash,
        dueAmount: this.dueAmount,
        items: this.cartItems,
      };

      const receiptHtml = this.buildReceiptFromCurrentSale(receipt);
  
  // Open in new window for printing
  const printWindow = window.open('', '_blank', 'width=400,height=600');
  if (printWindow) {
    printWindow.document.write(receiptHtml);
    printWindow.document.close();
  }
 

    console.log('Submitting receipt:', receipt);
      this.saleService.createSale(receipt).subscribe({
        next: async (response: any) => {
          const invoiceNo = response.data?.invoiceNo ?? response.invoiceNo;

          // Update customer balance using snapshot values (resetForm may have cleared this.*)
          if (snapCustomerId) {
            const delta = snapDueAmount - snapPreviousDue;
            if (delta !== 0) {
              this.customerService.updateCustomerBalance(snapCustomerId, {
                tenantId: 1,
                amount: Math.abs(delta),
                operationType: delta > 0 ? 'ADD' : 'SUBTRACT'
              }).subscribe();
            }
          }

          // If this session was opened from an Order, mark it Completed
          if (this.activeOrderId) {
            const saleId = response.data?.saleId ?? response.saleId ?? null;
            this.orderService.updateOrderStatus(this.activeOrderId, {
              status: 'Completed',
              completedSaleId: saleId ?? undefined
            }).subscribe();
            this.activeOrderId = null;
            await this.alertService.success(
              `Bill Submitted & Order Completed!\nInvoice: ${invoiceNo}`,
              'Order Done'
            );
            this.router.navigate(['/orders']);
            return;
          }

          await this.alertService.success(`Bill Submitted Successfully!\nInvoice: ${invoiceNo}`);
          this.resetForm();
        },
        error: (error) => {
          // Stock sold out by another counter between cart add and finalization
          if (SaleService.isStockConflict(error)) {
            const c: StockConflictError = error.error;
            this.alertService.error(
              `Stock Conflict — Sale Cannot Complete`,
              `"${c.productName}" is out of stock.\n` +
              `Available: ${c.available} unit(s) · Requested: ${c.required} unit(s).\n` +
              `Another counter completed a sale for this item just now.\n` +
              `Please remove or reduce the item and try again.`
            );
            // Highlight the conflicting item in the cart so the cashier can act
            this.markConflictItem(c.productId);
          } else {
            console.error('Error recording sale:', error);
            this.alertService.error('Error submitting bill', error.error?.message || error.message || 'An error occurred while submitting the bill.');
          }
        }
      });

    }
  }
  // Add this method to handle Tab key on quantity input
  onQuantityKeydown(event: KeyboardEvent): void {
    if (event.key === 'Tab') {
      event.preventDefault(); // Prevent default tab behavior
      this.addToCart(); // Call add to cart function
    }
  }
  // View invoice details
  async viewInvoice(invoice: Invoice): Promise<void> {
    await this.alertService.info(
      `Invoice Details:\nNumber: ${invoice.invoiceNo}\nCustomer: ${invoice.customerName}\nTotal: $${invoice.totalAmount}\nDiscount: $${invoice.discountAmount}\nGross: $${invoice.grossAmount}\nDate: ${invoice.date}`,
    );
  }

  // Print invoice
printInvoice(): void {
  console.log('Printing invoice...');
  
  // Build receipt from current cart data instead of static data
  //const receiptHTML = this.buildReceiptFromCurrentSale();
  
  // Open print preview window
 // this.openPrintPreview(receiptHTML);
}

// Build receipt HTML from current cart items
buildReceiptFromCurrentSale(receipt: any): string {
  // Helper function to format currency
  const formatTk = (amount: number): string => {
    return `৳ ${amount.toFixed(2)}`;
  };
  
  // Escape HTML special characters
  const escapeHtml = (str: string): string => {
    if (!str) return '';
    return str
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&#39;');
  };
  
  // Format date
  const formatDate = (date: Date): string => {
    const d = new Date(date);
    const day = d.getDate().toString().padStart(2, '0');
    const month = (d.getMonth() + 1).toString().padStart(2, '0');
    const year = d.getFullYear();
    const hours = d.getHours().toString().padStart(2, '0');
    const minutes = d.getMinutes().toString().padStart(2, '0');
    const seconds = d.getSeconds().toString().padStart(2, '0');
    return `${day}/${month}/${year} ${hours}:${minutes}:${seconds}`;
  };
  
  // Generate items HTML with fixed-width columns for thermal printer
  let itemsHtml = '';
  
  // if (!receipt.items || receipt.items.length === 0) {
  //   itemsHtml = '<pre class="item-pre">No items found</pre>';
  // } else {
  //   receipt.items.forEach((item: any) => {
  //     // Format product name (max 20 chars)
  //     let productName = item.product?.productName || item.productName || 'Unknown';
  //     productName = productName.length > 20 ? productName.substring(0, 17) + '...' : productName;
      
  //     const price = item.unitPrice || item.product?.salePrice || 0;
  //     const qty = item.quantity || 0;
  //     const amount = item.subtotal || (price * qty);
      
  //     // Fixed-width column formatting for thermal printer
  //     const productCol = productName.padEnd(20, ' ').substring(0, 20);
  //     const priceCol = price.toFixed(2).padStart(8, ' ');
  //     const qtyCol = qty.toString().padStart(5, ' ');
  //     const amountCol = amount.toFixed(2).padStart(10, ' ');
      
  //     itemsHtml += `<pre class="item-pre">${escapeHtml(productCol)} ${priceCol} ${qtyCol} ${amountCol}</pre>`;
  //   });
  // }

  const formatLine = (name: string, price: number, qty: number, total: number) => {
    const col1 = name.padEnd(16).substring(0, 16);
    const col2 = price.toFixed(0).padStart(6);
    const col3 = qty.toString().padStart(4);
    const col4 = total.toFixed(0).padStart(8);
    return `${col1}${col2}${col3}${col4}`;
  };

  // Items
  receipt.items.forEach((item: any) => {
    const line = formatLine(
      item.product.productName,
      item.unitPrice,
      item.quantity,
      item.subtotal
    );
    itemsHtml += `<pre class="item">${escapeHtml(line)}</pre>`;
  });

  
  // Calculate values from receipt object
  const subtotal = receipt.totalAmount || 0;
  const discount = receipt.discount || 0;
  const discountPercent = receipt.discountPercent || 0;
  const transportCost = receipt.transportCost || 0;
  const transport = receipt.transport || 'N/A';
  const prevDue = receipt.previousDue || 0;
  const netAmount = receipt.netAmount || (subtotal - discount + transportCost + prevDue);
  const paidAmount = receipt.paidAmount || 0;
  const returnAmount = receipt.returnAmount || 0;
  const dueAmount = receipt.dueAmount || (netAmount - paidAmount);
  const paymentType = receipt.paymentType || 'CASH';
  const invoiceNo = receipt.invoiceNo || 'N/A';
  const customerId = receipt.customerId || 'WALK-IN';
  
  // Get customer info (if available)
  const customerName = receipt.customerName || 'Walk-in Customer';
  const customerPhone = receipt.customerPhone || 'N/A';
  
  // Format date
  const saleDate = formatDate(receipt.saleDate || new Date());
  const dateStr = new Date(receipt.saleDate || new Date()).toLocaleDateString('en-GB', { 
    day: '2-digit', 
    month: 'short', 
    year: 'numeric' 
  }).toUpperCase();
  
  const timeStr = new Date(receipt.saleDate || new Date()).toLocaleTimeString('en-US', {
    hour: '2-digit',
    minute: '2-digit',
    hour12: true
  });
  
  return `
    <!DOCTYPE html>
    <html>
      <head>
        <meta charset="UTF-8">
        <meta name="viewport" content="width=device-width, initial-scale=1.0">
        <title>MiniMart Receipt - ${invoiceNo}</title>
        <style>
          * {
            margin: 0;
            padding: 0;
            box-sizing: border-box;
          }
          
          body {
            font-family: 'Courier New', 'Monaco', monospace;
            background: #f0f0f0;
            padding: 20px;
            display: flex;
            justify-content: center;
            align-items: center;
            min-height: 100vh;
          }
          
          .receipt {
            max-width: 350px;
            width: 100%;
            margin: 0 auto;
            background: white;
            padding: 16px 12px;
            box-shadow: 0 2px 8px rgba(0,0,0,0.1);
          }
          
          /* Thermal printer optimized */
          @media print {
            body {
              background: white;
              padding: 0;
              margin: 0;
            }
            .receipt {
              box-shadow: none;
              padding: 8px;
              max-width: 100%;
            }
            .no-print {
              display: none;
            }
          }
          
          /* Mobile responsive */
          @media (max-width: 480px) {
            .receipt {
              max-width: 100%;
              padding: 12px 8px;
            }
            body {
              padding: 10px;
            }
          }
          
          .text-center { 
            text-align: center; 
          }
          
          .text-right {
            text-align: right;
          }
          
          .text-left {
            text-align: left;
          }
          
          .shop-name {
            font-size: 18px;
            font-weight: bold;
            letter-spacing: 2px;
          }
          
          .shop-address {
            font-size: 9px;
            color: #555;
            margin-top: 4px;
          }
          
          .separator { 
            border-top: 1px dashed #000; 
            margin: 8px 0;
          }
          
          .separator-double {
            border-top: 2px solid #000;
            margin: 8px 0;
          }
          
          .item-pre {
            font-family: 'Courier New', monospace;
            font-size: 10px;
            margin: 2px 0;
            white-space: pre;
            letter-spacing: 0.5px;
          }
          
          .total-line {
            display: flex;
            justify-content: space-between;
            margin: 4px 0;
            font-size: 11px;
          }
          
          .total-line-bold {
            font-weight: bold;
            font-size: 12px;
          }
          
          .due-line {
            border-top: 1px double #000;
            margin-top: 6px;
            padding-top: 6px;
            font-weight: bold;
          }
          
          .receipt-footer {
            margin-top: 12px;
            text-align: center;
            font-size: 9px;
            color: #666;
          }
          
          .invoice-info {
            font-size: 9px;
            margin: 6px 0;
            display: flex;
            justify-content: space-between;
            flex-wrap: wrap;
            gap: 4px;
          }
          
          .payment-method {
            display: inline-block;
            padding: 2px 6px;
            background: #f0f0f0;
            font-weight: bold;
          }
          
          .thankyou {
            margin-top: 12px;
            padding-top: 8px;
            border-top: 1px dashed #000;
            text-align: center;
            font-style: italic;
          }
          
          @page {
            size: auto;
            margin: 0mm;
          }
        </style>
      </head>
      <body>
        <div class="receipt">
          <!-- Shop Header -->
          <div class="text-center">
            <div class="shop-name">LUCKY SHOP BD</div>
            <div class="shop-address">Mirpur-10, Kazipara, Dhaka-1216</div>
            <div class="shop-address">Tel: 01511-111111 | 01332-111111</div>
            <div class="shop-address">Email: luckyshopbd@gmail.com</div>
          </div>
          
          <div class="separator"></div>
          
          <!-- Invoice Info -->
          <div class="invoice-info">
            <span>INV: ${escapeHtml(invoiceNo)}</span>
            <span>Date: ${dateStr}</span>
          </div>
          <div class="invoice-info">
            <span>Time: ${timeStr}</span>
            <span>Customer: ${escapeHtml(customerId.toString())}</span>
          </div>
          <div class="invoice-info">
            <span>${escapeHtml(customerName)}</span>
            <span>Tel: ${escapeHtml(customerPhone)}</span>
          </div>
          
          <div class="separator"></div>
          
          <!-- Items Header -->
          <div>
            <pre class="item-pre" style="font-weight: bold;">
Item               Price Qty    Amount
--------------------------------------</pre>
            ${itemsHtml}
            <div class="separator"></div>
          </div>
          
          <!-- Totals -->
          <div>
            <div class="total-line">
              <span>Subtotal:</span>
              <span>${formatTk(subtotal)}</span>
            </div>
            
            ${discount > 0 ? `
            <div class="total-line">
              <span>Discount (${discountPercent}%):</span>
              <span>-${formatTk(discount)}</span>
            </div>
            ` : ''}
            
            ${transportCost > 0 ? `
            <div class="total-line">
              <span>Transport (${escapeHtml(transport)}):</span>
              <span>${formatTk(transportCost)}</span>
            </div>
            ` : ''}
            ${prevDue > 0 ? `
            <div class="total-line" style="color:#e74c3c; font-weight:bold">
              <span>Previous Due:</span>
              <span>+${formatTk(prevDue)}</span>
            </div>
            ` : ''}
            ${prevDue < 0 ? `
            <div class="total-line" style="color:#27ae60; font-weight:bold">
              <span>Advance Credit:</span>
              <span>-${formatTk(Math.abs(prevDue))}</span>
            </div>
            ` : ''}
          </div>
          
          <div class="separator"></div>
          
          <!-- Net Amount -->
          <div class="total-line total-line-bold">
            <span>NET TOTAL:</span>
            <span>${formatTk(netAmount)}</span>
          </div>
          
          <div class="separator"></div>
          
          <!-- Payment Details -->
          <div>
            <div class="total-line">
              <span>Payment Method:</span>
              <span class="payment-method">${escapeHtml(paymentType.toUpperCase())}</span>
            </div>
            <div class="total-line">
              <span>Paid Amount:</span>
              <span>${formatTk(paidAmount)}</span>
            </div>
            ${returnAmount > 0 ? `
            <div class="total-line">
              <span>Return Amount:</span>
              <span>${formatTk(returnAmount)}</span>
            </div>
            ` : ''}
          </div>
          
          ${dueAmount > 0 ? `
          <div class="due-line">
            <div class="total-line total-line-bold">
              <span>DUE AMOUNT:</span>
              <span style="color: #e74c3c;">${formatTk(dueAmount)}</span>
            </div>
          </div>
          ` : ''}
          
          ${dueAmount === 0 && paidAmount > 0 ? `
          <div class="due-line">
            <div class="total-line total-line-bold">
              <span>PAID IN FULL</span>
              <span>${formatTk(paidAmount)}</span>
            </div>
          </div>
          ` : ''}
          
          <div class="separator"></div>
          
          <!-- Footer -->
          <div class="thankyou">
            <div>Thank you for shopping!</div>
            <div style="font-size: 8px; margin-top: 4px;">** This is a computer generated receipt **</div>
            <div style="font-size: 8px;">** No signature required **</div>
          </div>
          
          <div class="receipt-footer">
            <div>Tel: 01511-111111</div>
            <div>Visit us again!</div>
            <div style="margin-top: 4px;">Have a great day!</div>
          </div>
          
          <!-- Print Button (only visible on screen) -->
          <div class="no-print" style="text-align: center; margin-top: 20px;">
            <button onclick="window.print()" style="padding: 10px 20px; font-size: 14px; cursor: pointer; background: #2ecc71; color: white; border: none; border-radius: 4px;">
              Print Receipt
            </button>
          </div>
        </div>
      </body>
    </html>
  `;
}

// Open print preview window
private openPrintPreview(receiptHTML: string): void {
  const printWindow = window.open('', '_blank', 'width=500,height=700,toolbar=yes,scrollbars=yes,resizable=yes');
  
  if (!printWindow) {
    this.alertService.warning('Please allow pop-ups to view receipt preview');
    return;
  }
  
  const styles = this.getReceiptStyles();
  
  printWindow.document.write(`
    <!DOCTYPE html>
    <html>
      <head>
        <meta charset="UTF-8">
        <meta name="viewport" content="width=device-width, initial-scale=1.0">
        <title>Receipt Preview - Lucky Shop BD</title>
        <style>${styles}</style>
      </head>
      <body>
        <div class="print-container">
          <div class="toolbar">
            <div class="toolbar-title">
              Receipt Preview
            </div>
            <div class="toolbar-buttons">
              <button class="btn-print" onclick="window.print()">
                Print Receipt
              </button>
              <button class="btn-close" onclick="window.close()">
                Close
              </button>
            </div>
          </div>
          <div class="receipt-wrapper">
            ${receiptHTML}
          </div>
        </div>
        <script>
          window.onload = function() {
            console.log('Print preview loaded');
          };
        <\/script>
      </body>
    </html>
  `);
  
  printWindow.document.close();
}

// Get receipt styles
private getReceiptStyles(): string {
  return `
    * {
      margin: 0;
      padding: 0;
      box-sizing: border-box;
    }
    
    body {
      background: #f0f0f0;
      font-family: 'Courier New', 'Monaco', monospace;
      padding: 20px;
      display: flex;
      justify-content: center;
      align-items: center;
      min-height: 100vh;
    }
    
    .print-container {
      background: white;
      box-shadow: 0 10px 40px rgba(0,0,0,0.1);
      border-radius: 8px;
      overflow: hidden;
      max-width: 450px;
      width: 100%;
    }
    
    .toolbar {
      background: #2c3e50;
      color: white;
      padding: 12px 20px;
      display: flex;
      justify-content: space-between;
      align-items: center;
      flex-wrap: wrap;
      gap: 10px;
    }
    
    .toolbar-title {
      font-size: 16px;
      font-weight: bold;
    }
    
    .toolbar-buttons {
      display: flex;
      gap: 8px;
    }
    
    .btn-print, .btn-close {
      padding: 8px 16px;
      border: none;
      border-radius: 4px;
      cursor: pointer;
      font-size: 13px;
      font-weight: 600;
    }
    
    .btn-print {
      background: #27ae60;
      color: white;
    }
    
    .btn-print:hover {
      background: #219a52;
    }
    
    .btn-close {
      background: #e74c3c;
      color: white;
    }
    
    .btn-close:hover {
      background: #c0392b;
    }
    
    .receipt-wrapper {
      padding: 20px;
    }
    
    @media print {
      body { background: white; padding: 0; }
      .print-container { box-shadow: none; border-radius: 0; }
      .toolbar { display: none; }
      .receipt-wrapper { padding: 0; }
    }
  `;
}
}
