import { Component, HostListener, OnInit, ElementRef, ViewChild, ChangeDetectorRef } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { ActivatedRoute, Router } from '@angular/router';
import { TranslocoModule, TranslocoService, provideTranslocoScope } from '@jsverse/transloco';
import { ProductService } from '../../services/product.service';
import { Product, ProductFilter } from '../../models/product';
import { FinancialInputComponent } from '../../shared/financial-input.component';
import { AlertService } from '../../shared/alert.service';
import { Customer, CustomerFilter, CustomerService } from '../../services/customer.service';
import { SaleService, StockConflictError, PromotionQuoteRequest, PromotionQuoteResult } from '../../services/sale.service';
import { ReceiptService, ReceiptData, ReceiptItem } from '../../services/receipt.service';
import { OrderService } from '../../services/order.service';
import { PayrollService, Employee } from '../../services/payroll.service';
import { AuthService } from '../../services/auth.service';
import JsBarcode from 'jsbarcode';
import { BnNumberAccessorDirective } from '../../shared/bn-number-accessor.directive';
import { PAYMENT_METHODS, DEFAULT_PAYMENT_METHOD } from '../../shared/payment-methods';
import { AppConfigService } from '../../services/app-config.service';
import { BnDigitsPipe } from '../../shared/bn-digits.pipe';
import { CashbackService } from '../../services/cashback.service';
import { RewardPointService } from '../../services/reward-point.service';


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
  imports: [CommonModule, FormsModule, FinancialInputComponent, TranslocoModule, BnNumberAccessorDirective, BnDigitsPipe],
  // scope name intentionally has no hyphen — a hyphenated name broke i18n lookups silently
  providers: [provideTranslocoScope('posBilling')],
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
    private payrollService: PayrollService,
    private authService: AuthService,
    private route: ActivatedRoute,
    private router: Router,
    private transloco: TranslocoService,
    private appConfigService: AppConfigService,
    private cashbackService: CashbackService,
    private rewardPointService: RewardPointService,
    private cdr: ChangeDetectorRef
  ) {
    this.receiptData = this.receiptService.getReceiptData();
  }

  // Price field editability comes from config.json (isSellingEditable), no rebuild needed to toggle
  get isSellingEditable(): boolean {
    return this.appConfigService.isSellingEditable;
  }

  // shorthand for the 'posBilling' transloco scope
  private t(key: string, params?: Record<string, unknown>): string {
    return this.transloco.translate(`posBilling.${key}`, params);
  }

  activeOrderId: number | null = null;
  orderLoading = false;
  Math = Math;
 @ViewChild('receiptContainer') receiptContainer!: ElementRef;

  receiptData: ReceiptData;
  receiptHTML: string = '';
  @ViewChild('productSearchInput') productSearchInput!: ElementRef;
  @ViewChild('customerSearchInput') customerSearchInput!: ElementRef;
  @ViewChild('quantityInput') quantityInput!: ElementRef;

  showProductDropdown: boolean = false;
  showCustomerDropdown: boolean = false;
  showDeliveryDropdown: boolean = false;

  selectedProductIndex: number = -1;
  selectedCustomerIndex: number = -1;
  selectedDeliveryIndex: number = -1;

  products: Product[] = [];

  selectedProduct: Product | null = null;

  customers: Customer[] = [];

  // employees list doubles as the delivery-man list, loaded once and filtered client-side
  employees: Employee[] = [];

  // transport detail: delivery/courier use selectedDeliveryManId (manual pick), pickup uses pickupEmployeeCode (auto session-derived)
  selectedDeliveryManId: number | null = null;
  searchDeliveryTerm: string = '';
  pickupByName: string = '';
  pickupEmployeeCode: string | null = null;

  cartItems: CartItem[] = [];
  // product IDs that failed with a stock conflict on the last finalization attempt
  conflictProductIds = new Set<number>();

  selectedProductId: number | null = null;
  selectedCustomerId: number | null = null;

  productQuantity: number = 1;

  // defaults to catalog salePrice; addToCart() always uses this field (not product.salePrice), editable only when isSellingEditable
  productPrice: number = 0;

  subtotal: number = 0;
  discountAmount: number = 0;
  discountPercent: number = 0;
  transportCost: number = 0;
  transportType: string = 'delivery';
  selectedPaymentMethod: string = DEFAULT_PAYMENT_METHOD;
  // canonical payment-method list, shared across Payroll/Counter/Purchases/Capital
  readonly paymentMethods = PAYMENT_METHODS;
  paymentCash: number = 0;
  returnCash: number = 0;
  dueAmount: number = 0;
  grossAmount: number = 0;

  // balances are informational only; all discount/redemption math happens server-side in PromotionEngineService
  customerRewardPointBalance: number = 0;
  customerCashbackBalance: number = 0;
  redeemPointsInput: number | null = null;
  redeemCashbackInput: number | null = null;

  // live read-only preview from POST /sales/quote (PromotionEngineService.GetQuoteAsync), debounced; single source of truth so calculateTotals() doesn't reimplement the math
  promotionQuote: PromotionQuoteResult | null = null;
  quoteLoading = false;
  private quoteDebounceHandle: any = null;

  searchProductTerm: string = '';
  searchCustomerTerm: string = '';
  customerPhone: string = '';

  invoices: Invoice[] = [];

  filters: ProductFilter = {
    tenantId: null,
    isActive: true,
    categoryId: null,
  };

  ngOnInit(): void {
    this.loadProducts();
    this.loadCustomers();
    this.loadEmployees();
    this.loadSampleInvoices();

    this.route.queryParams.subscribe(params => {
      const orderId = params['orderId'];
      if (orderId) {
        this.activeOrderId = +orderId;
        this.loadOrderIntoCart(+orderId);
      }
    });
  }

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

          this.transportCost = order.transport || 0;

          // discount is stored/handled as an amount; percentage is derived in calculateTotals()
          this.discountAmount = order.discount || 0;

          // bulk one-shot load, show discount immediately
          this.calculateTotals(true);

          if (order.customerName) {
            this.searchCustomerTerm = order.customerName;
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
            this.t('messages.orderLoadedBody', {
              id: orderId,
              count: order.items.length,
              customer: order.customerName || this.t('messages.walkIn')
            }),
            this.t('messages.orderLoadedTitle')
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

  loadEmployees(): void {
    this.payrollService.getEmployees(true).subscribe({
      next: (res: any) => {
        // API may return a paginated wrapper object instead of a plain array
        this.employees = Array.isArray(res)
          ? res
          : (res?.data ?? res?.items ?? res?.employees ?? []);
      },
      error: (err: any) => {
        console.error('Error loading employees:', err);
      },
    });
  }

  loadProducts(): void {
    this.productService.getAllProducts(this.filters).subscribe({
      next: (data: any) => {
        // API may return a paginated wrapper object instead of a plain array
        this.products = Array.isArray(data)
          ? data
          : (data?.data ?? data?.items ?? data?.products ?? []).filter((p: Product) => p.stockQty > 0);
      },
      error: (err: any) => {
        console.error('Error loading products:', err);
      },
    });
  }

  loadSampleInvoices(): void {
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
      const lower = term.toLowerCase();
      // barcode scanners send keystrokes like typing, so check for an exact barcode/name match first (scanned codes are never partial)
      const exactMatch =
        this.filteredProducts.find((product) => product.barcode?.toLowerCase() === lower) ||
        this.filteredProducts.find((product) => product.productName?.toLowerCase() === lower);

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
      this.customerRewardPointBalance = 0;
      this.customerCashbackBalance = 0;
      this.redeemPointsInput = null;
      this.redeemCashbackInput = null;
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

  scrollToSelectedCustomer(): void {
    setTimeout(() => {
      const selectedElement = document.querySelector('.customer-dropdown-item.selected');
      if (selectedElement) {
        selectedElement.scrollIntoView({ block: 'nearest', behavior: 'smooth' });
      }
    }, 0);
  }

  // delivery-man searchable dropdown mirrors the customer/product ones above
  // "Full Name-EMP001" format keeps employees with the same first name distinguishable
  deliveryManLabel(employee: Employee): string {
    return `${employee.fullName}-${employee.employeeCode}`;
  }

  onDeliverySearch(term: string): void {
    this.searchDeliveryTerm = term;
    this.showDeliveryDropdown = true;
    this.selectedDeliveryIndex = -1;

    // typing over an already-picked name invalidates that selection until they pick again
    if (this.selectedDeliveryManId) {
      const current = this.employees.find((e) => e.employeeId === this.selectedDeliveryManId);
      if (!current || this.deliveryManLabel(current) !== term) {
        this.selectedDeliveryManId = null;
      }
    }

    if (term.length > 0 && this.filteredDeliveryEmployees.length > 0) {
      const exactMatch = this.filteredDeliveryEmployees.find(
        (e) =>
          this.deliveryManLabel(e).toLowerCase() === term.toLowerCase() ||
          e.fullName?.toLowerCase() === term.toLowerCase(),
      );
      if (exactMatch) {
        this.selectDeliveryMan(exactMatch);
      }
    }
  }

  onDeliveryKeydown(event: KeyboardEvent): void {
    if (!this.showDeliveryDropdown || this.filteredDeliveryEmployees.length === 0) {
      if (event.key === 'Enter' && this.searchDeliveryTerm.length > 0) {
        event.preventDefault();
        this.selectBestMatchDeliveryMan();
      }
      return;
    }

    switch (event.key) {
      case 'ArrowDown':
        event.preventDefault();
        this.selectedDeliveryIndex = Math.min(
          this.selectedDeliveryIndex + 1,
          this.filteredDeliveryEmployees.length - 1,
        );
        this.scrollToSelectedDelivery();
        break;

      case 'ArrowUp':
        event.preventDefault();
        this.selectedDeliveryIndex = Math.max(this.selectedDeliveryIndex - 1, -1);
        this.scrollToSelectedDelivery();
        break;

      case 'Enter':
        event.preventDefault();
        if (
          this.selectedDeliveryIndex >= 0 &&
          this.selectedDeliveryIndex < this.filteredDeliveryEmployees.length
        ) {
          this.selectDeliveryMan(this.filteredDeliveryEmployees[this.selectedDeliveryIndex]);
        } else if (this.filteredDeliveryEmployees.length > 0) {
          this.selectDeliveryMan(this.filteredDeliveryEmployees[0]);
        }
        break;

      case 'Escape':
        event.preventDefault();
        this.showDeliveryDropdown = false;
        this.selectedDeliveryIndex = -1;
        break;
    }
  }

  scrollToSelectedDelivery(): void {
    setTimeout(() => {
      const selectedElement = document.querySelector('.delivery-dropdown-item.selected');
      if (selectedElement) {
        selectedElement.scrollIntoView({ block: 'nearest', behavior: 'smooth' });
      }
    }, 0);
  }

  selectBestMatchDeliveryMan(): void {
    if (this.searchDeliveryTerm.length === 0) return;
    const term = this.searchDeliveryTerm.toLowerCase();

    let bestMatch = this.employees.find(
      (e) => this.deliveryManLabel(e).toLowerCase() === term || e.fullName?.toLowerCase() === term,
    );

    if (!bestMatch) {
      bestMatch = this.employees.find((e) => e.fullName?.toLowerCase().startsWith(term));
    }
    if (!bestMatch) {
      bestMatch = this.employees.find((e) => e.fullName?.toLowerCase().includes(term));
    }
    if (bestMatch) {
      this.selectDeliveryMan(bestMatch);
    }
  }

  selectDeliveryMan(employee: Employee): void {
    this.selectedDeliveryManId = employee.employeeId;
    this.searchDeliveryTerm = this.deliveryManLabel(employee);
    this.showDeliveryDropdown = false;
    this.selectedDeliveryIndex = -1;
  }

  selectBestMatchProduct(): void {
    if (this.searchProductTerm.length === 0) return;

    const term = this.searchProductTerm.toLowerCase();

    // scanners can fire Enter before onProductSearch's exact-match check runs, so recheck barcode here first
    let bestMatch = this.products.find((product) => product.barcode?.toLowerCase() === term);

    if (!bestMatch) {
      bestMatch = this.products.find((product) => product.productName?.toLowerCase() === term);
    }

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
    this.productPrice = product.salePrice || 0;
    this.showProductDropdown = false;
    this.selectedProductIndex = -1;

    setTimeout(() => {
      // uses #quantityInput ref (not a type="number" selector) since BnNumberAccessorDirective rewrites the input's type to "text" for Bangla digits
      this.quantityInput?.nativeElement?.focus();
    }, 0);
  }

  selectCustomer(customer: Customer): void {
    this.selectedCustomerId = customer.customerId;
    this.searchCustomerTerm = customer.customerName;
    this.customerPhone = customer.phone || '';
    this.showCustomerDropdown = false;
    this.selectedCustomerIndex = -1;
    this.discountAmount = 0;
    this.discountPercent = 0;
    this.calculateTotals(true);
    this.loadLoyaltyBalances(customer.customerId);
  }

  // reward point / cashback balance for the currently selected customer — display-only
  loadLoyaltyBalances(customerId: number): void {
    this.customerRewardPointBalance = 0;
    this.customerCashbackBalance = 0;
    this.redeemPointsInput = null;
    this.redeemCashbackInput = null;

    this.rewardPointService.getCustomerSummary(customerId).subscribe({
      next: (res) => (this.customerRewardPointBalance = res.data?.rewardPointBalance || 0),
      error: () => {} // module may not be configured for this tenant yet — fail silently
    });
    this.cashbackService.getCustomerSummary(customerId).subscribe({
      next: (res) => (this.customerCashbackBalance = res.data?.cashbackBalance || 0),
      error: () => {}
    });
  }

  // builds a "what got auto-applied" line from SaleResponseDto's promotion breakdown fields (see SaleService.CreateSale on the backend)
  buildPromotionSummaryLine(sale: any): string {
    const parts: string[] = [];
    if (sale?.promotionDiscountAmount > 0) parts.push(`৳${(+sale.promotionDiscountAmount).toFixed(2)} auto-discount`);
    if (sale?.cashbackEarned > 0) parts.push(`+৳${(+sale.cashbackEarned).toFixed(2)} cashback`);
    if (sale?.cashbackRedeemed > 0) parts.push(`−৳${(+sale.cashbackRedeemed).toFixed(2)} cashback redeemed`);
    if (sale?.rewardPointsEarned > 0) parts.push(`+${sale.rewardPointsEarned} pts`);
    if (sale?.rewardPointsRedeemed > 0) parts.push(`−${sale.rewardPointsRedeemed} pts redeemed`);
    if (Array.isArray(sale?.promotionWarnings) && sale.promotionWarnings.length > 0) {
      parts.push(...sale.promotionWarnings);
    }
    return parts.length ? `(${parts.join(' · ')})` : '';
  }

  resetProduct(): void {
    this.selectedProduct = null;
    this.selectedProductId = null;
    this.searchProductTerm = '';
    this.productQuantity = 1;
    this.productPrice = 0;
    this.showProductDropdown = false;
    this.selectedProductIndex = -1;
  }

  // highlights the conflicting cart item in red and auto-clears after 8s
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
    this.discountAmount = 0;
    this.discountPercent = 0;
    this.transportCost = 0;
    this.transportType = 'delivery';
    this.selectedDeliveryManId = null;
    this.searchDeliveryTerm = '';
    this.showDeliveryDropdown = false;
    this.pickupByName = '';
    this.pickupEmployeeCode = null;
    this.selectedPaymentMethod = DEFAULT_PAYMENT_METHOD;
    this.paymentCash = 0;
    this.customerRewardPointBalance = 0;
    this.customerCashbackBalance = 0;
    this.redeemPointsInput = null;
    this.redeemCashbackInput = null;
    this.promotionQuote = null;
    this.calculateTotals();
  }

  onTransportCostChange(value: string | number): void {
    const numValue = typeof value === 'string' ? parseFloat(value) : value;
    this.transportCost = isNaN(numValue) ? 0 : Math.max(0, numValue);
    this.calculateTotals();
  }

  onTransportTypeChange(value: string): void {
    this.transportType = value;

    // Clear the type-specific fields whenever the transport type changes so
    // stale data from a previous selection can't leak onto the receipt.
    this.selectedDeliveryManId = null;
    this.searchDeliveryTerm = '';
    this.showDeliveryDropdown = false;
    this.pickupByName = '';
    this.pickupEmployeeCode = null;

    // Optional: Set predefined transport costs based on type
    switch (value) {
      case 'delivery':
      case 'courier':
        // Employee must be picked from the searchable list — mandatory,
        // enforced in submitBill(). Delivery and Courier share the exact
        // same picker (both need to know which staff member is handling it).
        // this.transportCost = 50; // Uncomment to set a default charge
        break;
      case 'pickup': {
        // auto-selected from the logged-in counter user's session (Users.EmployeeId -> Employee.EmployeeCode), never a manual pick
        const sessionUser = this.authService.getUser();
        this.pickupEmployeeCode = sessionUser?.employeeCode || null;
        this.pickupByName = this.pickupEmployeeCode
          ? (sessionUser?.employeeName
              ? `${sessionUser.employeeName}-${this.pickupEmployeeCode}`
              : this.pickupEmployeeCode)
          : (sessionUser?.userName || '');
        break;
      }
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
    if (!target.closest('.delivery-search-container')) {
      this.showDeliveryDropdown = false;
      this.selectedDeliveryIndex = -1;
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

  get selectedCustomer(): Customer | undefined {
    if (!Array.isArray(this.customers)) return undefined;
    return this.customers.find((c) => c.customerId === this.selectedCustomerId);
  }

  // unlike products/customers, shows the full employee list on an empty search term so it works as a simple picker, not just a type-ahead
  get filteredDeliveryEmployees(): Employee[] {
    if (!Array.isArray(this.employees)) return [];
    const term = this.searchDeliveryTerm.trim().toLowerCase();
    const list = term
      ? this.employees.filter(
          (e) =>
            e.fullName?.toLowerCase().includes(term) ||
            e.employeeCode?.toLowerCase().includes(term) ||
            (e.mobile || '').includes(this.searchDeliveryTerm),
        )
      : this.employees;
    return list.slice(0, 10);
  }

  // this is what gets stored on Sales.DeliveryManCode (varchar, not a numeric FK)
  get selectedDeliveryManCode(): string | null {
    const emp = this.employees.find((e) => e.employeeId === this.selectedDeliveryManId);
    return emp?.employeeCode || null;
  }

  get transportDetail(): string {
    switch (this.transportType) {
      case 'delivery':
      case 'courier': {
        const emp = this.employees.find((e) => e.employeeId === this.selectedDeliveryManId);
        return emp?.fullName || '';
      }
      case 'pickup':
        return this.pickupByName;
      default:
        return '';
    }
  }

  // positive = customer owes (due), negative = customer has credit
  get previousDue(): number {
    return this.selectedCustomer?.currentBalance || 0;
  }

  onProductQuantityChange(value: string | number): void {
    const numValue = typeof value === 'string' ? parseFloat(value) : value;
    const min = this.isWeightProduct ? 0.001 : 1;
    this.productQuantity = isNaN(numValue) ? min : Math.max(min, numValue);
  }

  // only reachable when isSellingEditable is true — the field is [readonly] otherwise
  onProductPriceChange(value: string | number): void {
    const numValue = typeof value === 'string' ? parseFloat(value) : value;
    this.productPrice = isNaN(numValue) ? 0 : Math.max(0, numValue);
  }

  get isWeightProduct(): boolean {
    const wt = ['KG', 'G', 'L', 'ML'];
    return !!this.selectedProduct && wt.includes((this.selectedProduct.unitType || '').toUpperCase());
  }

  get qtyStep(): string { return this.isWeightProduct ? '0.001' : '1'; }
  get qtyUnit(): string { return this.selectedProduct?.unitType || 'PCS'; }

  // discount is entered as an amount; percentage is derived
  onDiscountAmountChange(value: string | number): void {
    const numValue = typeof value === 'string' ? parseFloat(value) : value;
    this.discountAmount = isNaN(numValue) ? 0 : Math.max(0, numValue);
    this.calculateTotals();
  }

  onPaymentCashChange(value: string | number): void {
    const numValue = typeof value === 'string' ? parseFloat(value) : value;
    this.paymentCash = isNaN(numValue) ? 0 : Math.max(0, numValue);
    this.calculateReturnAndDue();
  }

  async addToCart() {
    if (!this.selectedProduct) {
      this.alertService.info(this.t('messages.noProductSelectedBody'), this.t('messages.noProductSelectedTitle'));
      setTimeout(() => {
        if (this.productSearchInput) {
          this.productSearchInput.nativeElement.focus();
        }
      }, 0);
      return;
    }

    const product = this.selectedProduct;

    if (this.productQuantity > product.stockQty) {
      await this.alertService.warning(this.t('messages.stockAvailable', { qty: product.stockQty }));
      return;
    }

    const existingItem = this.cartItems.find(
      (item) => item.product.productId === product.productId,
    );

    if (existingItem) {
      const newQuantity = existingItem.quantity + this.productQuantity;
      if (newQuantity > product.stockQty) {
        await this.alertService.warning(this.t('messages.stockAvailable', { qty: product.stockQty }));
        return;
      }
      existingItem.quantity = newQuantity;
      existingItem.subtotal = existingItem.quantity * this.productPrice;
    } else {
      this.cartItems.push({
        productId: product.productId,
        product: product,
        quantity: this.productQuantity,
        unitPrice: this.productPrice,
        subtotal: this.productQuantity * this.productPrice,
      });
    }

    // discrete add-to-cart action: fetch the promo quote now, not after the debounce, so the discount shows immediately
    this.calculateTotals(true);
    this.resetProduct();

    setTimeout(() => {
      if (this.productSearchInput) {
        this.productSearchInput.nativeElement.focus();
      }
    }, 0);
  }

  removeFromCart(item: CartItem): void {
    const index = this.cartItems.indexOf(item);
    if (index > -1) {
      this.cartItems.splice(index, 1);
      this.calculateTotals(true);
    }
  }

  clearCart(): void {
    if (confirm('Are you sure you want to clear the cart?')) {
      this.cartItems = [];
      this.discountAmount = 0;
      this.discountPercent = 0;
      this.promotionQuote = null;
      this.calculateTotals();
    }
  }

  // 0 while no quote has come back yet
  get promoDiscountAmount(): number {
    return this.promotionQuote?.autoDiscountAmount || 0;
  }

  lineDiscount(productId: number): number {
    return this.promotionQuote?.lineDiscountByProductId?.[String(productId)] ?? 0;
  }

  // itemized "Buy X, get Y free" lines from the live quote; product names are resolved client-side since the backend quote only carries ProductId
  get freeItemPromotions(): Array<{ description: string; lines: Array<{ name: string; qty: number; value: number }> }> {
    return (this.promotionQuote?.appliedPromotions || [])
      .filter(p => p.freeItems && p.freeItems.length > 0)
      .map(p => ({
        description: p.description,
        lines: p.freeItems!.map(f => ({
          name: this.products.find(pr => pr.productId === f.productId)?.productName || `#${f.productId}`,
          qty: f.qty,
          value: f.value
        }))
      }));
  }

  // immediate=true skips the debounce for discrete one-shot actions (add/remove line, pick customer, load order); false (default) is for continuous-typing fields
  calculateTotals(immediate: boolean = false): void {
    this.applyLocalTotals();
    // refreshPromotionQuote's callback only calls applyLocalTotals(), never calculateTotals() again, so this doesn't loop
    this.refreshPromotionQuote(immediate);
  }

  // reuses whatever promo quote is already cached
  private applyLocalTotals(): void {
    this.subtotal = this.cartItems.reduce((sum, item) => sum + item.subtotal, 0);

    if (this.discountAmount < 0) this.discountAmount = 0;
    if (this.discountAmount > this.subtotal) this.discountAmount = this.subtotal;
    this.discountPercent = this.subtotal > 0
      ? +((this.discountAmount / this.subtotal) * 100).toFixed(2)
      : 0;

    // auto (product) discount mirrors exactly what PromotionEngineService applies server-side at checkout — see refreshPromotionQuote()
    const saleNet = this.subtotal - this.discountAmount - this.promoDiscountAmount + this.transportCost;

    // positive due adds, negative credit deducts
    this.grossAmount = saleNet + this.previousDue;

    if (this.grossAmount < 0) {
      this.grossAmount = 0;
    }

    this.calculateReturnAndDue();
  }

  // calls POST /sales/quote (PromotionEngineService.GetQuoteAsync, same engine CreateSale uses, no transaction/writes); immediate=true skips the debounce for discrete cart actions
  refreshPromotionQuote(immediate: boolean = false): void {
    if (this.quoteDebounceHandle) {
      clearTimeout(this.quoteDebounceHandle);
      this.quoteDebounceHandle = null;
    }

    if (this.cartItems.length === 0) {
      if (this.promotionQuote) {
        this.promotionQuote = null;
        this.applyLocalTotals();
      }
      return;
    }

    const fetchQuote = () => {
      const payload: PromotionQuoteRequest = {
        customerId: this.selectedCustomerId || 0,
        items: this.cartItems.map(i => ({
          productId: i.productId,
          quantity: i.quantity,
          unitPrice: i.unitPrice
        })),
        manualDiscount: this.discountAmount,
        transportCost: this.transportCost,
        redeemPoints: this.redeemPointsInput,
        redeemCashback: this.redeemCashbackInput
      };

      this.quoteLoading = true;
      this.saleService.getPromotionQuote(payload).subscribe({
        next: (res) => {
          this.quoteLoading = false;
          this.promotionQuote = res.data;
          this.applyLocalTotals();
          // forces the *ngIf-bound discount badge to paint immediately instead of on the next unrelated DOM event (same pattern as customer.component.ts)
          this.cdr.detectChanges();
        },
        error: () => {
          // quote preview is best-effort — a failed preview must never block billing
          this.quoteLoading = false;
          this.promotionQuote = null;
          this.applyLocalTotals();
          this.cdr.detectChanges();
        }
      });
    };

    if (immediate) {
      fetchQuote();
    } else {
      this.quoteDebounceHandle = setTimeout(fetchQuote, 350);
    }
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

  async submitBill() {
    if (this.cartItems.length === 0) {
      await this.alertService.warning(this.t('messages.cartEmptyWarning'));
      return;
    }
    if ((this.transportType === 'delivery' || this.transportType === 'courier') && !this.selectedDeliveryManId) {
      await this.alertService.warning(this.t('messages.deliveryManRequiredWarning'));
      return;
    }
    if (this.transportType === 'pickup' && !this.pickupEmployeeCode) {
      await this.alertService.warning(this.t('messages.pickupEmployeeRequiredWarning'));
      return;
    }
    console.log("customer ",this.selectedCustomer)
    console.log("customerq2 ",this.customers)

    const confirmed = await this.alertService.confirm(
      this.t('messages.confirmSubmitBody', { amount: this.grossAmount.toFixed(2) }),
      this.t('messages.confirmSubmitTitle'),
    );
    if (!confirmed) {
      return;
    }

    {
      const newInvoice: Invoice = {
        invoiceNo: 'INV-' + Date.now(),
        customerName: this.selectedCustomer?.customerName || '',
        totalAmount: this.subtotal,
        discountAmount: this.discountAmount,
        grossAmount: this.grossAmount,
        date: new Date().toLocaleDateString(),
      };


      const saleNet = this.subtotal - this.discountAmount + this.transportCost;

      // capture before resetForm() clears them
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
        // already folded into netAmount below like the manual discount; buildReceiptFromCurrentSale prints one line per entry so combo discounts aren't invisible on the printed receipt
        promoDiscount: this.promoDiscountAmount,
        appliedPromotions: this.promotionQuote?.appliedPromotions || [],
        transportCost: this.transportCost,
        transport: this.transportType,
        transportDetail: this.transportDetail,
        // only EmployeeCode is persisted (Sales.DeliveryManCode, varchar, no numeric FK); delivery/courier use the picked employee, pickup uses the session's own employee code
        deliveryManCode:
          (this.transportType === 'delivery' || this.transportType === 'courier')
            ? this.selectedDeliveryManCode
            : (this.transportType === 'pickup' ? this.pickupEmployeeCode : null),
        previousDue: this.previousDue,
        previousBalance: snapPreviousDue,
        netAmount: this.grossAmount,
        paymentType: this.selectedPaymentMethod,
        paidAmount: this.paymentCash,
        returnAmount: this.returnCash,
        dueAmount: this.dueAmount,
        items: this.cartItems,
        // printed at the bottom of the receipt, not persisted anywhere new
        generatedBy: this.authService.getUser()?.userName || '',
        // validated/capped server-side against the customer's balance and REWARD_POINT_CONFIG (see PromotionEngineService.EvaluateAsync); null/0 means "no redemption requested"
        redeemPoints: this.redeemPointsInput || null,
        redeemCashback: this.redeemCashbackInput || null,
      };

      const receiptHtml = this.buildReceiptFromCurrentSale(receipt);

      // auto-prints to the 58mm thermal printer via a hidden iframe (no preview/button); the native print dialog still appears unless the browser runs with a silent-print flag (e.g. Chrome's --kiosk-printing)
      this.printReceiptSilently(receiptHtml);

    console.log('Submitting receipt:', receipt);
      this.saleService.createSale(receipt).subscribe({
        next: async (response: any) => {
          const invoiceNo = response.data?.invoiceNo ?? response.invoiceNo;
          const saleId = response.data?.saleId ?? response.saleId ?? null;

          if (saleId) {
          }

          // if this session was opened from an Order, mark it Completed
          if (this.activeOrderId) {
            this.orderService.updateOrderStatus(this.activeOrderId, {
              status: 'Completed',
              completedSaleId: saleId ?? undefined
            }).subscribe();
            this.activeOrderId = null;
            await this.alertService.success(
              this.t('messages.orderCompleteBody', { invoiceNo }),
              this.t('messages.orderCompleteTitle')
            );
            this.router.navigate(['/orders']);
            return;
          }

          const promoSummary = this.buildPromotionSummaryLine(response.data ?? response);
          await this.alertService.success(
            this.t('messages.billSubmittedSuccess', { invoiceNo }) + (promoSummary ? ` ${promoSummary}` : '')
          );
          this.resetForm();
          // reload products (updated stock) and customers (updated balance)
          this.loadProducts();
          this.loadCustomers();
        },
        error: (error) => {
          // stock sold out by another counter between cart add and finalization
          if (SaleService.isStockConflict(error)) {
            const c: StockConflictError = error.error;
            this.alertService.error(
              this.t('messages.stockConflictTitle'),
              this.t('messages.stockConflictBody', {
                productName: c.productName,
                available: c.available,
                required: c.required
              })
            );
            this.markConflictItem(c.productId);
          } else {
            console.error('Error recording sale:', error);
            // args are (message, title) — reversed from what you'd expect, pre-existing AlertService.error signature; only the title is localized
            this.alertService.error(this.t('messages.submitBillErrorTitle'), error.error?.message || error.message || 'An error occurred while submitting the bill.');
          }
        }
      });

    }
  }
  onQuantityKeydown(event: KeyboardEvent): void {
    if (event.key === 'Tab') {
      event.preventDefault();
      this.addToCart();
    }
  }
  async viewInvoice(invoice: Invoice): Promise<void> {
    await this.alertService.info(
      this.t('messages.invoiceDetails', {
        number: invoice.invoiceNo,
        customer: invoice.customerName,
        total: invoice.totalAmount,
        discount: invoice.discountAmount,
        gross: invoice.grossAmount,
        date: invoice.date
      }),
    );
  }

  printInvoice(): void {
  console.log('Printing invoice...');
}

// renders a CODE128 barcode to a standalone SVG string, dropped into the receipt HTML as static markup so the print iframe needs no script execution or network access
private generateBarcodeSvg(value: string): string {
  try {
    const svgEl = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
    JsBarcode(svgEl, value, {
      format: 'CODE128',
      width: 1.3,
      height: 32,
      displayValue: true,
      fontSize: 9,
      margin: 0,
    });
    return new XMLSerializer().serializeToString(svgEl);
  } catch {
    // shouldn't happen (invoiceNo is always "INV-<number>", valid CODE128); fall back to plain text
    return `<div style="font-size:9px;">${value}</div>`;
  }
}

buildReceiptFromCurrentSale(receipt: any): string {
  const formatTk = (amount: number): string => {
    return `৳ ${amount.toFixed(2)}`;
  };

  const escapeHtml = (str: string): string => {
    if (!str) return '';
    return str
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&#39;');
  };

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

  // Item table — a flexbox row (fixed-px numeric columns + flex:1 name),
  // NOT monospace text padded to a character count. Character-padding
  // (the previous approach) only lines up if every browser/printer driver
  // measures "1 monospace char" as exactly the same pixel width, which in
  // practice varies enough to either clip text past 58mm's ~204px printable
  // width or leave columns misaligned between the header and item rows.
  // Flexbox with explicit pixel widths lines up exactly, by construction,
  // regardless of font metrics — the same technique already used for
  // .total-line/.invoice-info elsewhere in this receipt.
  const itemRow = (name: string, price: string, qty: string, amount: string, bold = false): string => `
    <div class="item-row"${bold ? ' style="font-weight:700"' : ''}>
      <span class="item-col-name">${escapeHtml(name)}</span>
      <span class="item-col-price">${escapeHtml(price)}</span>
      <span class="item-col-qty">${escapeHtml(qty)}</span>
      <span class="item-col-amount">${escapeHtml(amount)}</span>
    </div>`;

  const itemsHeaderLine = itemRow('Item', 'Price', 'Qty', 'Amount', true);

  // Items
  receipt.items.forEach((item: any) => {
    itemsHtml += itemRow(
      item.product.productName,
      item.unitPrice.toFixed(0),
      item.quantity.toString(),
      item.subtotal.toFixed(0)
    );
  });


  // Calculate values from receipt object
  const subtotal = receipt.totalAmount || 0;
  const discount = receipt.discount || 0;
  const discountPercent = receipt.discountPercent || 0;
  const promoDiscount = receipt.promoDiscount || 0;
  const appliedPromotions: Array<{
    promotionType: string;
    description: string;
    discountAmount: number;
    freeItems?: Array<{ productId: number; qty: number; value: number }> | null;
  }> = receipt.appliedPromotions || [];
  // Resolve a free combo line's ProductId back to a name using the cart items
  // already on this receipt (the free product must be in the cart for the
  // combo to have qualified in the first place, so it's always found here).
  const freeItemProductName = (productId: number): string =>
    receipt.items.find((it: any) => it.product?.productId === productId)?.product?.productName || `#${productId}`;
  const transportCost = receipt.transportCost || 0;
  const transport = receipt.transport || 'N/A';
  const transportDetail = receipt.transportDetail || '';
  const transportDetailLabel =
    receipt.transport === 'delivery' ? 'Delivery Man' :
    receipt.transport === 'courier' ? 'Courier' :
    receipt.transport === 'pickup' ? 'Picked Up By' : 'Assigned To';
  const prevDue = receipt.previousDue || 0;
  const netAmount = receipt.netAmount || (subtotal - discount - promoDiscount + transportCost + prevDue);
  const paidAmount = receipt.paidAmount || 0;
  const returnAmount = receipt.returnAmount || 0;
  const dueAmount = receipt.dueAmount || (netAmount - paidAmount);
  const paymentType = receipt.paymentType || 'CASH';
  const invoiceNo = receipt.invoiceNo || 'N/A';
  const customerId = receipt.customerId || 'WALK-IN';
  const generatedBy = receipt.generatedBy || '';
  const invoiceBarcodeSvg = this.generateBarcodeSvg(invoiceNo);

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
            background: #fff;
            color: #000;
            margin: 0;
            padding: 0;
          }

          .receipt {
            width: 58mm;
            margin: 0;
            background: #fff;
            color: #000;
            padding: 2mm;
          }

          @media print {
            body {
              background: #fff;
              margin: 0;
              padding: 0;
            }
            .receipt {
              padding: 2mm;
              width: 58mm;
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
            color: #000;
            font-weight: 600;
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

          /* Item table — flexbox row with fixed-px numeric columns, not
             monospace text padded to a character count. This is what makes
             the header and every item row line up EXACTLY: CSS box widths
             are precise regardless of font/browser/printer-driver metrics,
             where counting "monospace characters" is only ever an estimate.
             .receipt is 58mm with 2mm padding each side (~204px printable at
             96dpi) — 34+22+40=96px of fixed numeric columns leaves
             flex:1 / ~100px+ for the name, comfortably within budget. */
          .item-row {
            display: flex;
            align-items: baseline;
            font-family: 'Courier New', monospace;
            font-size: 10px;
            font-weight: 600;
            color: #000;
            margin: 2px 0;
          }
          .item-col-name {
            flex: 1;
            min-width: 0;
            overflow: hidden;
            text-overflow: ellipsis;
            white-space: nowrap;
            padding-right: 2px;
          }
          .item-col-price, .item-col-qty, .item-col-amount {
            flex: none;
            text-align: right;
            white-space: nowrap;
          }
          .item-col-price  { width: 34px; }
          .item-col-qty    { width: 22px; }
          .item-col-amount { width: 40px; }

          .total-line {
            display: flex;
            justify-content: space-between;
            margin: 4px 0;
            font-size: 11px;
            font-weight: 600;
            color: #000;
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
            color: #000;
            font-weight: 600;
          }

          .invoice-info {
            font-size: 9px;
            font-weight: 600;
            color: #000;
            margin: 6px 0;
            display: flex;
            justify-content: space-between;
            flex-wrap: wrap;
            gap: 4px;
          }

          .payment-method {
            display: inline-block;
            padding: 2px 6px;
            background: #eee;
            color: #000;
            font-weight: bold;
          }

          .thankyou {
            margin-top: 12px;
            padding-top: 8px;
            border-top: 1px dashed #000;
            text-align: center;
            font-style: italic;
          }

          .barcode-section {
            margin-top: 10px;
            text-align: center;
          }

          .barcode-section svg {
            max-width: 100%;
            height: auto;
          }

          @page {
            size: 58mm auto;
            margin: 0mm;
          }
        </style>
      </head>
      <body>
        <div class="receipt">
          <!-- Shop Header -->
          <div class="text-center">
            <div class="shop-name">LUCKY SHOP</div>
            <div class="shop-address">আড়াইহাজার বাজার, ব্যাটারী গলির দক্ষিণ পাশে, বাঁশ পট্টি নতুন রাস্তার মোড়</div>
            <div class="shop-address">Tel: 01716881160</div>

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

          <!-- Items table — header + rows are both built by itemRow() above,
               a flexbox row, so the columns are pixel-aligned by CSS layout
               rather than by counting monospace characters. -->
          <div>
            ${itemsHeaderLine}
            <div class="separator" style="margin-top: 2px;"></div>
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

            <!-- Auto product-wise/combo discounts (PromotionEngineService) —
                 one line per applied promotion so a combo discount is named
                 and visible, not just silently folded into Net Total. Falls
                 back to a single lump "Promo Discount" line if the list is
                 empty but a total is present, in case an older/partial
                 receipt payload doesn't carry the itemized list. -->
            ${appliedPromotions.length > 0 ? appliedPromotions.map(p => `
            <div class="total-line">
              <span>${p.promotionType === 'Combo' ? 'Combo' : 'Discount'}: ${escapeHtml(p.description || '')}</span>
              <span>-${formatTk(p.discountAmount || 0)}</span>
            </div>
            ${(p.freeItems || []).map(f => `
            <div class="total-line" style="padding-left:6px;font-size:10px">
              <span>&nbsp;&nbsp;Free: ${escapeHtml(freeItemProductName(f.productId))} x${f.qty}</span>
              <span>(${formatTk(f.value || 0)} value)</span>
            </div>
            `).join('')}
            `).join('') : (promoDiscount > 0 ? `
            <div class="total-line">
              <span>Promo Discount:</span>
              <span>-${formatTk(promoDiscount)}</span>
            </div>
            ` : '')}

            ${transportCost > 0 ? `
            <div class="total-line">
              <span>Transport (${escapeHtml(transport)}):</span>
              <span>${formatTk(transportCost)}</span>
            </div>
            ` : ''}
            ${transportDetail ? `
            <div class="total-line">
              <span>${transportDetailLabel}:</span>
              <span>${escapeHtml(transportDetail)}</span>
            </div>
            ` : ''}
            ${prevDue > 0 ? `
            <div class="total-line" style="color:#000; font-weight:bold">
              <span>Previous Due:</span>
              <span>+${formatTk(prevDue)}</span>
            </div>
            ` : ''}
            ${prevDue < 0 ? `
            <div class="total-line" style="color:#000; font-weight:bold">
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
              <span>*** DUE AMOUNT ***:</span>
              <span style="color: #000;">${formatTk(dueAmount)}</span>
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
            <div>Tel: 01716881160</div>
            <div>Visit us again!</div>
            <div style="margin-top: 4px;">Have a great day!</div>
            ${generatedBy ? `<div style="margin-top: 4px;">Generated by: ${escapeHtml(generatedBy)}</div>` : ''}
          </div>

          <!-- Barcode: encodes the invoice number, printed at the very bottom -->
          <div class="barcode-section">
            ${invoiceBarcodeSvg}
          </div>

        </div>
      </body>
    </html>
  `;
}

// private openInvoicePdf(saleId: number, preOpenedTab: Window | null): void {
//   const token = this.authService.getToken();
//   const url = this.saleService.getInvoicePdfUrl(saleId, token);

//   if (preOpenedTab && !preOpenedTab.closed) {
//     preOpenedTab.location.href = url;
//   } else {
//     // Pre-opened tab was blocked or already closed — best effort direct open.
//    // window.open(url, '_blank');
//     window.open(url, 'InvoiceWindow');
//   }
// }

private openInvoicePdf(saleId: number): void {
  const token = this.authService.getToken();
  const url = this.saleService.getInvoicePdfUrl(saleId, token);

  // Reuse the same "Invoice" tab every time
  window.open(url, 'InvoiceWindow');
}

// Silently print the receipt to the thermal printer via a hidden iframe —
// nothing is shown to the cashier and no click is required.
private printReceiptSilently(receiptHtml: string): void {
  const iframe = document.createElement('iframe');
  iframe.style.position = 'fixed';
  iframe.style.right = '0';
  iframe.style.bottom = '0';
  iframe.style.width = '0';
  iframe.style.height = '0';
  iframe.style.border = '0';
  iframe.setAttribute('aria-hidden', 'true');
  document.body.appendChild(iframe);

  let cleaned = false;
  const cleanup = () => {
    if (cleaned) return;
    cleaned = true;
    // Small delay so the print job has actually been handed off before we
    // tear down the iframe it's printing from.
    setTimeout(() => {
      if (iframe.parentNode) {
        iframe.parentNode.removeChild(iframe);
      }
    }, 1000);
  };

  const doc = iframe.contentWindow?.document;
  if (!doc) {
    cleanup();
    return;
  }

  doc.open();
  doc.write(receiptHtml);
  doc.close();

  iframe.onload = () => {
    const win = iframe.contentWindow;
    if (!win) {
      cleanup();
      return;
    }
    win.addEventListener('afterprint', cleanup, { once: true });
    win.focus();
    win.print();
    // Fallback in case 'afterprint' never fires in some browser/driver setups.
    cleanup();
  };
}

// Open print preview window
private openPrintPreview(receiptHTML: string): void {
  const printWindow = window.open('', '_blank', 'width=500,height=700,toolbar=yes,scrollbars=yes,resizable=yes');

  if (!printWindow) {
    this.alertService.warning(this.t('messages.allowPopups'));
    return;
  }

  const styles = this.getReceiptStyles();

  printWindow.document.write(`
    <!DOCTYPE html>
    <html>
      <head>
        <meta charset="UTF-8">
        <meta name="viewport" content="width=device-width, initial-scale=1.0">
        <title>Receipt Preview - Lucky Shop</title>
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
