import { Component, HostListener, OnInit, ElementRef, ViewChild } from '@angular/core';
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
  // Note: ActivatedRoute + Router are injected but not imported here (they're provided by the router module)
  // Loads assets/i18n/posBilling/{en,bn}.json only when this route is hit —
  // see Multilingual_Localization_Architecture.md Section 5.1.
  // Scope name deliberately has no hyphen (unlike the folder's old name) —
  // a hyphenated scope name caused all lookups to silently miss.
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
    private rewardPointService: RewardPointService
  ) {
    this.receiptData = this.receiptService.getReceiptData();
  }

  /** Whether the "Price" field below is user-editable — set via config.json
   *  (isSellingEditable), no rebuild needed to toggle it. */
  get isSellingEditable(): boolean {
    return this.appConfigService.isSellingEditable;
  }

  /** Shorthand for the 'posBilling' scope — see provideTranslocoScope above. */
  private t(key: string, params?: Record<string, unknown>): string {
    return this.transloco.translate(`posBilling.${key}`, params);
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
  showDeliveryDropdown: boolean = false;

  // Keyboard navigation indices
  selectedProductIndex: number = -1;
  selectedCustomerIndex: number = -1;
  selectedDeliveryIndex: number = -1;

  // Products Data
  products: Product[] = [];

  // Selected Product
  selectedProduct: Product | null = null;

  // Customers Data
  customers: Customer[] = [];

  // Employees (used as the delivery-man list) — loaded once, filtered client-side
  employees: Employee[] = [];

  // Transport detail — exactly one of these is meaningful, depending on transportType:
  //  - delivery: selectedDeliveryManId (picked from the searchable employee list, mandatory)
  //  - courier:  selectedDeliveryManId (same searchable employee list, mandatory)
  //  - pickup:   pickupEmployeeCode (auto-filled from the logged-in counter user's
  //              linked employee — session-derived, not a manual pick)
  selectedDeliveryManId: number | null = null;
  searchDeliveryTerm: string = '';
  pickupByName: string = '';
  pickupEmployeeCode: string | null = null;

  // Cart Items
  cartItems: CartItem[] = [];
  /** Product IDs that failed with a stock conflict on the last finalization attempt */
  conflictProductIds = new Set<number>();

  // Selected IDs
  selectedProductId: number | null = null;
  selectedCustomerId: number | null = null;

  // Quantities
  productQuantity: number = 1;

  // Sale price for the product currently being added — defaults to the
  // catalog salePrice, editable only when isSellingEditable is true (see
  // the "Price" field in the template). addToCart() always uses this value
  // (not product.salePrice directly), so when it's read-only it's simply
  // never changed from the catalog price anyway.
  productPrice: number = 0;

  // Payment Info
  subtotal: number = 0;
  discountAmount: number = 0;
  discountPercent: number = 0;
  transportCost: number = 0;
  transportType: string = 'delivery';
  selectedPaymentMethod: string = DEFAULT_PAYMENT_METHOD;
  /** Canonical payment-method options — same list on every page (Payroll/Counter/Purchases/Capital). */
  readonly paymentMethods = PAYMENT_METHODS;
  paymentCash: number = 0;
  returnCash: number = 0;
  dueAmount: number = 0;
  grossAmount: number = 0;

  // ── Promotion & Loyalty (redemption at checkout) ─────────────────────
  // Balances are informational only — the actual discount/redemption math
  // (product discounts, combos, cashback, points) all happens server-side
  // in PromotionEngineService, so nothing here is computed client-side.
  // These just tell the cashier what's redeemable and carry the cashier's
  // requested redemption amount along with the sale.
  customerRewardPointBalance: number = 0;
  customerCashbackBalance: number = 0;
  redeemPointsInput: number | null = null;
  redeemCashbackInput: number | null = null;

  // ── Live promotion quote (product discount preview) ──────────────────
  // Unlike the redemption balances above, product-wise discounts DO need to
  // be calculated and shown live as the cashier builds the cart — this is
  // the read-only preview from POST /sales/quote (PromotionEngineService.
  // GetQuoteAsync), refreshed (debounced) on every cart/customer/discount/
  // transport change. Kept as the single source of truth for the auto
  // discount amount so calculateTotals() never re-implements the money math.
  promotionQuote: PromotionQuoteResult | null = null;
  quoteLoading = false;
  private quoteDebounceHandle: any = null;

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
    this.loadEmployees();
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

          // Discount is stored/handled as an amount; percentage is derived in calculateTotals()
          this.discountAmount = order.discount || 0;

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

  // --- Delivery-man searchable dropdown (mirrors the customer/product ones above) ---

  /** "Full Name-EMP001" — shown in the dropdown and filled into the search
   *  box once picked, so two employees with the same first name stay distinguishable. */
  deliveryManLabel(employee: Employee): string {
    return `${employee.fullName}-${employee.employeeCode}`;
  }

  onDeliverySearch(term: string): void {
    this.searchDeliveryTerm = term;
    this.showDeliveryDropdown = true;
    this.selectedDeliveryIndex = -1;

    // Typing over an already-picked name invalidates that selection until
    // they pick again — keeps the "mandatory for delivery" check honest.
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
    this.productPrice = product.salePrice || 0;
    this.showProductDropdown = false;
    this.selectedProductIndex = -1;

    setTimeout(() => {
      // Was `document.querySelector('input[type="number"]')` — broke once
      // BnNumberAccessorDirective started rewriting this input's type to
      // "text" at runtime (needed to display Bangla digits). The #quantityInput
      // template ref is stable regardless of the input's current type attribute.
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
    this.calculateTotals();
    this.loadLoyaltyBalances(customer.customerId);
  }

  /** Reward point / cashback balance for the currently selected customer — display-only. */
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

  /**
   * Short "what got auto-applied" line built from SaleResponseDto's
   * promotion breakdown fields (PromotionDiscountAmount, CashbackEarned,
   * RewardPointsEarned, etc. — see SaleService.CreateSale on the backend).
   * Returns '' when nothing promotion-related happened on this sale.
   */
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

  // Handle transport cost changes
  onTransportCostChange(value: string | number): void {
    const numValue = typeof value === 'string' ? parseFloat(value) : value;
    this.transportCost = isNaN(numValue) ? 0 : Math.max(0, numValue);
    this.calculateTotals();
  }

  // Handle transport type changes
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
        // Auto-selected from whoever is logged in at this counter — pulled
        // from their session (Users.EmployeeId → Employee.EmployeeCode),
        // never a manual pick. The field is readonly in the template.
        const sessionUser = this.authService.getUser();
        this.pickupEmployeeCode = sessionUser?.employeeCode || null;
        this.pickupByName = this.pickupEmployeeCode
          ? (sessionUser?.employeeName
              ? `${sessionUser.employeeName}-${this.pickupEmployeeCode}`
              : this.pickupEmployeeCode)
          : (sessionUser?.userName || '');
        // this.transportCost = 0; // Uncomment to set zero for pickup
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

  // Filtered delivery-man list — unlike products/customers, shows the full
  // (short) employee list even with an empty search term so it works as a
  // simple picker, not just a type-ahead.
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

  /** EmployeeCode of the selected delivery man — this is what actually gets
   *  stored on the Sales row (Sales.DeliveryManCode is varchar, not a numeric FK). */
  get selectedDeliveryManCode(): string | null {
    const emp = this.employees.find((e) => e.employeeId === this.selectedDeliveryManId);
    return emp?.employeeCode || null;
  }

  /** Resolves the right "assigned to" display value for the current transport type. */
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

  /** Only reachable when isSellingEditable is true — the field is [readonly] otherwise. */
  onProductPriceChange(value: string | number): void {
    const numValue = typeof value === 'string' ? parseFloat(value) : value;
    this.productPrice = isNaN(numValue) ? 0 : Math.max(0, numValue);
  }

  /** True when selected product is sold by weight/volume (KG, G, L, ML) */
  get isWeightProduct(): boolean {
    const wt = ['KG', 'G', 'L', 'ML'];
    return !!this.selectedProduct && wt.includes((this.selectedProduct.unitType || '').toUpperCase());
  }

  /** Input step and display unit for the quantity field */
  get qtyStep(): string { return this.isWeightProduct ? '0.001' : '1'; }
  get qtyUnit(): string { return this.selectedProduct?.unitType || 'PCS'; }

  // Helper method for discount entered as an AMOUNT (percentage is derived).
  onDiscountAmountChange(value: string | number): void {
    const numValue = typeof value === 'string' ? parseFloat(value) : value;
    this.discountAmount = isNaN(numValue) ? 0 : Math.max(0, numValue);
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
      this.discountAmount = 0;
      this.discountPercent = 0;
      this.promotionQuote = null;
      this.calculateTotals();
    }
  }

  /** Auto product-discount total from the live quote — 0 while no quote has come back yet. */
  get promoDiscountAmount(): number {
    return this.promotionQuote?.autoDiscountAmount || 0;
  }

  /** Per-product auto-discount amount from the live quote — feeds the cart line badge. */
  lineDiscount(productId: number): number {
    return this.promotionQuote?.lineDiscountByProductId?.[String(productId)] ?? 0;
  }

  // Calculate Totals
  calculateTotals(): void {
    this.applyLocalTotals();
    // Cart/customer/discount/transport changed — refresh the live promo
    // preview (debounced). Its callback only calls applyLocalTotals(), never
    // calculateTotals() again, so this doesn't loop.
    this.refreshPromotionQuote();
  }

  /** Local (synchronous) total math — reuses whatever promo quote is already cached. */
  private applyLocalTotals(): void {
    // Calculate subtotal
    this.subtotal = this.cartItems.reduce((sum, item) => sum + item.subtotal, 0);

    // Discount is entered as an amount; clamp it and derive the percentage.
    if (this.discountAmount < 0) this.discountAmount = 0;
    if (this.discountAmount > this.subtotal) this.discountAmount = this.subtotal;
    this.discountPercent = this.subtotal > 0
      ? +((this.discountAmount / this.subtotal) * 100).toFixed(2)
      : 0;

    // Sale net = items - manual discount - auto (product) discount + transport
    // (before adding previous customer balance). The auto discount mirrors
    // exactly what PromotionEngineService will apply server-side at checkout
    // (same engine, read-only preview) — see refreshPromotionQuote().
    const saleNet = this.subtotal - this.discountAmount - this.promoDiscountAmount + this.transportCost;

    // Gross = saleNet + previousDue (positive due adds, negative credit deducts)
    this.grossAmount = saleNet + this.previousDue;

    // Ensure gross amount is not negative
    if (this.grossAmount < 0) {
      this.grossAmount = 0;
    }

    // Calculate return and due
    this.calculateReturnAndDue();
  }

  /**
   * Debounced live preview of product-wise discounts for the current cart —
   * calls POST /sales/quote (PromotionEngineService.GetQuoteAsync, the exact
   * same calc engine CreateSale uses, just without a transaction/writes) so
   * the cashier sees the discount before finalising the sale. Only updates
   * `promotionQuote` + re-applies local totals; never re-triggers itself.
   */
  refreshPromotionQuote(): void {
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

    this.quoteDebounceHandle = setTimeout(() => {
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
        },
        error: () => {
          // Quote preview is best-effort — a failed preview must never block
          // billing, it just means no live discount is shown this round.
          this.quoteLoading = false;
          this.promotionQuote = null;
          this.applyLocalTotals();
        }
      });
    }, 350);
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
      this.t('messages.confirmSubmitBody', { amount: this.grossAmount.toFixed(2) }),
      this.t('messages.confirmSubmitTitle'),
    );
    if (confirmed) {
      // Pre-open a blank tab now, still inside the click→confirm gesture
      // chain — browsers are far more likely to block a window.open() that
      // happens later, after the createSale HTTP round trip finishes. We
      // just navigate this same tab to the invoice PDF URL once we know the
      // new saleId — see openInvoicePdf().
      const invoiceTab = window.open('', '_blank');

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
        transportDetail: this.transportDetail,
        // Only the EmployeeCode is persisted (Sales.DeliveryManCode, varchar) —
        // no numeric FK column exists for this on Sales. Delivery/Courier use
        // whichever employee was picked from the dropdown; Pickup uses the
        // counter user's own linked employee code from session.
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
        // Who was logged in at this counter when the bill was made — printed
        // at the bottom of the receipt, not persisted anywhere new.
        generatedBy: this.authService.getUser()?.userName || '',
        // Promotion & Loyalty redemption — validated/capped server-side
        // against the customer's actual balance and the active
        // REWARD_POINT_CONFIG (see PromotionEngineService.EvaluateAsync).
        // null/0 here just means "no redemption requested".
        redeemPoints: this.redeemPointsInput || null,
        redeemCashback: this.redeemCashbackInput || null,
      };

      const receiptHtml = this.buildReceiptFromCurrentSale(receipt);

      // Auto-print straight to the 58mm thermal printer — no preview window
      // and no manual "Print" button. Runs silently via a hidden iframe.
      // Note: the browser's native print dialog will still appear on submit
      // unless the browser is launched with a silent-print flag (e.g. Chrome's
      // --kiosk-printing), which skips the dialog and prints to the default
      // printer automatically.
      this.printReceiptSilently(receiptHtml);

    console.log('Submitting receipt:', receipt);
      this.saleService.createSale(receipt).subscribe({
        next: async (response: any) => {
          const invoiceNo = response.data?.invoiceNo ?? response.invoiceNo;
          const saleId = response.data?.saleId ?? response.saleId ?? null;

          // Balance update handled by sp_AddSale (@PreviousBalance param) — no separate call needed

          // Auto-generate the invoice PDF and show it in the tab opened
          // above — doesn't navigate away from the Counter page, and the
          // cashier can print/save straight from the browser's PDF viewer.
          if (saleId) {
            this.openInvoicePdf(saleId, invoiceTab);
          } else if (invoiceTab) {
            invoiceTab.close();
          }

          // If this session was opened from an Order, mark it Completed
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
          // Reload products (updated stock) and customers (updated balance)
          this.loadProducts();
          this.loadCustomers();
        },
        error: (error) => {
          // Sale never got created — nothing to show, close the blank tab
          // opened pre-emptively above rather than leaving it stranded.
          if (invoiceTab && !invoiceTab.closed) {
            invoiceTab.close();
          }

          // Stock sold out by another counter between cart add and finalization
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
            // Highlight the conflicting item in the cart so the cashier can act
            this.markConflictItem(c.productId);
          } else {
            console.error('Error recording sale:', error);
            // NOTE: args here are (message, title) per AlertService.error's signature —
            // that's already reversed from what you'd expect (pre-existing, not
            // introduced by this change); only the literal title string is localized.
            this.alertService.error(this.t('messages.submitBillErrorTitle'), error.error?.message || error.message || 'An error occurred while submitting the bill.');
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

  // Print invoice
printInvoice(): void {
  console.log('Printing invoice...');

  // Build receipt from current cart data instead of static data
  //const receiptHTML = this.buildReceiptFromCurrentSale();

  // Open print preview window
 // this.openPrintPreview(receiptHTML);
}

// Renders a CODE128 barcode of the given value to a standalone SVG string —
// generated here (in the app's own document, where JsBarcode is bundled)
// and dropped into the receipt HTML as static markup, so the print iframe
// needs no script execution or network access to show it.
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
    // Shouldn't happen (invoiceNo is always "INV-<number>", valid CODE128) —
    // fall back to plain text rather than losing the invoice number entirely.
    return `<div style="font-size:9px;">${value}</div>`;
  }
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
  const transportDetail = receipt.transportDetail || '';
  const transportDetailLabel =
    receipt.transport === 'delivery' ? 'Delivery Man' :
    receipt.transport === 'courier' ? 'Courier' :
    receipt.transport === 'pickup' ? 'Picked Up By' : 'Assigned To';
  const prevDue = receipt.previousDue || 0;
  const netAmount = receipt.netAmount || (subtotal - discount + transportCost + prevDue);
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

          .item-pre, .item {
            font-family: 'Courier New', monospace;
            font-size: 10px;
            font-weight: 600;
            color: #000;
            margin: 2px 0;
            white-space: pre;
            letter-spacing: 0.5px;
          }

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

// Points `preOpenedTab` (opened via window.open('', '_blank') right when the
// cashier confirmed the sale, so it isn't treated as an unsolicited popup) at
// the invoice PDF's real URL — a plain top-level navigation, not a blob:
// fetch. Two earlier approaches were tried and both failed in current
// Chrome/Firefox: (1) creating a blob: URL here and assigning it to the
// other tab's location — blob: URLs are partitioned per top-level browsing
// context, so a tab that didn't create one itself silently fails to load
// it; (2) postMessage-ing the Blob to a loader page in that tab — worked in
// principle but left the tab stuck on "Loading invoice…" (message never
// got through reliably). Navigating straight to the real API URL sidesteps
// both: the browser's native PDF viewer just requests and renders it like
// any other link, no JS handoff required. The JWT can't ride an
// Authorization header on a plain navigation, so it's passed as
// ?access_token= instead — see SaleService.getInvoicePdfUrl().
private openInvoicePdf(saleId: number, preOpenedTab: Window | null): void {
  const token = this.authService.getToken();
  const url = this.saleService.getInvoicePdfUrl(saleId, token);

  if (preOpenedTab && !preOpenedTab.closed) {
    preOpenedTab.location.href = url;
  } else {
    // Pre-opened tab was blocked or already closed — best effort direct open.
    window.open(url, '_blank');
  }
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
