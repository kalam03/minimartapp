import { Component, HostListener, OnInit, ElementRef, ViewChild } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { ProductService } from '../../services/product.service';
import { Product, ProductFilter } from '../../models/product';
import { FinancialInputComponent } from '../../shared/financial-input.component';
import { AlertService } from '../../shared/alert.service';
import { Customer, CustomerFilter, CustomerService } from '../../services/customer.service';
import { SaleService } from '../../services/sale.service';
import { ReceiptService, ReceiptData, ReceiptItem } from '../../services/receipt.service';


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
  templateUrl: './pos-billing.html',
  styleUrls: ['./pos-billing.css'],
})
export class PosBillingComponent implements OnInit {
  constructor(
    private productService: ProductService,
    private customerService: CustomerService,
    private alertService: AlertService,
    private saleService: SaleService,
    private receiptService: ReceiptService

  ) {
    this.receiptData = this.receiptService.getReceiptData();
  }
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
  }

  loadCustomers(): void {
    let Custfilters: CustomerFilter = {
      tenantId: 1,
    };
    this.customerService.getAllCustomers(Custfilters).subscribe({
      next: (data) => {
        this.customers = data;
      },
      error: (err: any) => {
        console.error('Error loading customers:', err);
      },
    });
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
    this.selectedCustomerIndex = -1; // Reset selection when searching

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

  resetForm(): void {
    this.cartItems = [];
    this.selectedCustomerId = null;
    this.searchCustomerTerm = '';
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

  // Filtered Customers
  get filteredCustomers(): Customer[] {
    if (!this.searchCustomerTerm) return [];
    return this.customers
      .filter(
        (customer) =>
          customer.customerName?.toLowerCase().includes(this.searchCustomerTerm.toLowerCase()) ||
          customer.address.toLowerCase().includes(this.searchCustomerTerm.toLowerCase()) ||
          customer.phone.includes(this.searchCustomerTerm),
      )
      .slice(0, 10);
  }

  // Get Selected Customer
  get selectedCustomer(): Customer | undefined {
    return this.customers.find((c) => c.customerId === this.selectedCustomerId);
  }

  // Helper method for product quantity
  onProductQuantityChange(value: string | number): void {
    const numValue = typeof value === 'string' ? parseInt(value, 10) : value;
    this.productQuantity = isNaN(numValue) ? 1 : Math.max(1, numValue);
  }

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

    // Calculate gross amount (subtotal - discount + transport)
    // Transport cost is properly added here
    this.grossAmount = this.subtotal - this.discountAmount + this.transportCost;

    // Ensure gross amount is not negative
    if (this.grossAmount < 0) {
      this.grossAmount = 0;
    }

    // Calculate return and due
    this.calculateReturnAndDue();

    // Debug log to verify calculations
    console.log('Totals calculated:', {
      subtotal: this.subtotal,
      discount: this.discountAmount,
      transport: this.transportCost,
      gross: this.grossAmount,
    });
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

    if (!this.selectedCustomerId) {
      await this.alertService.warning('Please select a customer.');
      return;
    }

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


      const receipt = {
        invoiceNo: newInvoice.invoiceNo,
        saleDate: new Date(),
        customerId: this.selectedCustomer?.customerId,
        totalAmount: this.subtotal,
        discount: this.discountAmount,
        discountPercent: this.discountPercent,
        transportCost: this.transportCost,
        transport: this.transportType,
        netAmount: this.grossAmount,
        paymentType: this.selectedPaymentMethod,
        paidAmount: this.paymentCash,
        returnAmount: this.returnCash,
        dueAmount: this.dueAmount,
        items: this.cartItems,
      };

    console.log('Submitting receipt:', receipt);
      this.saleService.createSale(receipt).subscribe({
        next: async (response: any) => {
           await this.alertService.success(`Bill Submitted Successfully!\nInvoice: ${response.invoiceNo}`);
        },
        error: (error) => {
          console.error('Error recording sale:', error);
          this.alertService.error('Error submitting bill', error.message || 'An error occurred while submitting the bill. Please try again.');
        }
      });

    }

    //this.invoices.unshift(newInvoice);
    this.resetForm();
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
  const receiptHTML = this.buildReceiptFromCurrentSale();
  
  // Open print preview window
  this.openPrintPreview(receiptHTML);
}

// Build receipt HTML from current cart items
private buildReceiptFromCurrentSale(): string {
  // Generate items with fixed-width columns for thermal printer
  let itemsHtml = '';
  
  const formatItemLine = (product: string, price: number, qty: number, amount: number): string => {
    const productCol = product.padEnd(20, ' ').substring(0, 20);
    const priceCol = price.toString().padStart(8, ' ');
    const qtyCol = qty.toString().padStart(6, ' ');
    const amountCol = amount.toString().padStart(10, ' ');
    return `${productCol}${priceCol}${qtyCol}${amountCol}`;
  };
  
  if (this.cartItems.length === 0) {
    itemsHtml = `
      <pre class="item-pre">Item1                        10   100      1000</pre>
      <pre class="item-pre">item2                        10   100      1000</pre>
      <pre class="item-pre">item3                        10   100      1000</pre>
    `;
  } else {
    this.cartItems.forEach((item) => {
      const line = formatItemLine(
        item.product.productName,
        item.unitPrice,
        item.quantity,
        item.subtotal
      );
      itemsHtml += `<pre class="item-pre">${this.escapeHtml(line)}</pre>`;
    });
  }
  
  const customerMobile = this.selectedCustomer?.phone || '01611111111';
  const generatedBy = 'admin1';
  const subtotal = this.subtotal;
  const transportCost = this.transportCost;
  const totalAmount = subtotal + transportCost;
  const discount = this.discountAmount;
  const grossAmount = this.grossAmount;
  const paid = this.paymentCash;
  const due = this.dueAmount;
  const paymentMethod = this.selectedPaymentMethod.toUpperCase();
  const dateStr = new Date().toLocaleDateString('en-GB', { 
    day: '2-digit', 
    month: 'short', 
    year: 'numeric' 
  }).toUpperCase();
  
  return `
    <!DOCTYPE html>
    <html>
      <head>
        <meta charset="UTF-8">
        <title>MiniMart Receipt</title>
        <style>
          body {
            font-family: 'Courier New', monospace;
            margin: 0;
            padding: 20px;
            background: white;
          }
          .receipt {
            max-width: 400px;
            margin: 0 auto;
            font-size: 12px;
          }
          .text-center { text-align: center; }
          .separator { 
            border-top: 1px dashed #000; 
            margin: 5px 0;
          }
          .item-pre {
            font-family: 'Courier New', monospace;
            font-size: 11px;
            margin: 2px 0;
            white-space: pre;
          }
          .total-line {
            display: flex;
            justify-content: space-between;
            margin: 3px 0;
          }
          .due-line {
            border-top: 1px double #000;
            margin-top: 5px;
            padding-top: 5px;
            font-weight: bold;
          }
          @media print {
            body { padding: 0; }
          }
        </style>
      </head>
      <body>
        <div class="receipt">
          <div class="text-center">
            <div><b>INVICE RECEIPT</b></div>
            <div><b>Minimar Shop</b></div>
            <div>Dhaka,mirpur-10,kazipara-123</div>
            <div>Email:minimart@gmail.com,mobile:0151111111,0133211111</div>
          </div>
          
          <div style="display: flex; justify-content: space-between; margin: 8px 0;">
            <span>customer mobile:${customerMobile}</span>
            <span>generate BY:${generatedBy}</span>
          </div>
          
          <div class="separator"></div>
          
          <div>
            <pre style="font-family: monospace; margin: 5px 0;">
Product              Price  Qty    Amount
==========================================================</pre>
            ${itemsHtml}
            <pre style="font-family: monospace;">==========================================================</pre>
          </div>
          
          <div>
            <div class="total-line">
              <span>Subtotal :</span>
              <span>${this.formatTk(subtotal).padStart(15)}</span>
            </div>
            <div class="total-line">
              <span>Transport cost :</span>
              <span>${this.formatTk(transportCost).padStart(15)}</span>
            </div>
          </div>
          
          <div class="separator"></div>
          
          <div>
            <div class="total-line">
              <span>Total :</span>
              <span>${this.formatTk(totalAmount).padStart(20)}</span>
            </div>
            <div class="total-line">
              <span>Discount :</span>
              <span>${this.formatTk(discount).padStart(20)}</span>
            </div>
          </div>
          
          <div class="separator"></div>
          
          <div>
            <div class="total-line">
              <span>Gross :</span>
              <span>${this.formatTk(grossAmount).padStart(20)}</span>
            </div>
            <div class="total-line">
              <span>Paid :</span>
              <span>${this.formatTk(paid).padStart(21)}</span>
            </div>
          </div>
          
          <div class="separator"></div>
          
          <div class="due-line">
            <div class="total-line">
              <span>Due</span>
              <span>${this.formatTk(due).padStart(26)}</span>
            </div>
          </div>
          
          <div class="separator"></div>
          
          <div style="display: flex; justify-content: space-between;">
            <span>Payment method : ${paymentMethod}</span>
            <span>date:${dateStr}</span>
          </div>
          
          <div class="separator"></div>
          
          <div class="text-center">
            ================Take Care your self==========================
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
        <title>Receipt Preview - MiniMart POS</title>
        <style>${styles}</style>
      </head>
      <body>
        <div class="print-container">
          <div class="toolbar">
            <div class="toolbar-title">
              🧾 Receipt Preview
            </div>
            <div class="toolbar-buttons">
              <button class="btn-print" onclick="window.print()">
                🖨️ Print Receipt
              </button>
              <button class="btn-close" onclick="window.close()">
                ✖️ Close
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
      gap: 10px;
    }
    
    .toolbar button {
      padding: 8px 16px;
      border: none;
      border-radius: 4px;
      cursor: pointer;
      font-family: monospace;
      font-size: 14px;
      font-weight: bold;
      transition: all 0.2s;
    }
    
    .btn-print {
      background: #27ae60;
      color: white;
    }
    
    .btn-print:hover {
      background: #229954;
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
      background: white;
      display: flex;
      justify-content: center;
    }
    
    .thermal-receipt {
      max-width: 350px;
      width: 100%;
      font-family: 'Courier New', monospace;
      font-size: 12px;
      line-height: 1.4;
      color: #000;
    }
    
    .text-center {
      text-align: center;
    }
    
    .bold {
      font-weight: bold;
    }
    
    hr {
      border: none;
      border-top: 1px dashed #000;
      margin: 8px 0;
    }
    
    .dashed {
      border-top: 1px dashed #aaa;
    }
    
    .shop-name {
      font-size: 18px;
      font-weight: bold;
      margin-bottom: 5px;
    }
    
    .shop-address, .shop-contact {
      font-size: 10px;
      margin: 2px 0;
    }
    
    .order-info, .payment-info {
      margin: 10px 0;
    }
    
    .info-row {
      display: flex;
      justify-content: space-between;
      margin: 4px 0;
    }
    
    .items-header {
      margin: 5px 0;
    }
    
    .item-row {
      display: flex;
      justify-content: space-between;
      margin: 4px 0;
    }
    
    .header-row {
      font-weight: bold;
    }
    
    .item-name {
      flex: 2;
      word-break: break-word;
    }
    
    .item-qty {
      flex: 1;
      text-align: center;
    }
    
    .item-total {
      flex: 1;
      text-align: right;
    }
    
    .totals {
      margin: 10px 0;
    }
    
    .total-row {
      display: flex;
      justify-content: space-between;
      margin: 6px 0;
    }
    
    .due {
      font-weight: bold;
      border-top: 1px double #000;
      margin-top: 5px;
      padding-top: 5px;
    }
    
    .due-amount {
      color: #e74c3c;
    }
    
    .paid-full {
      margin-top: 5px;
    }
    
    .paid-status {
      color: #27ae60;
      font-weight: bold;
    }
    
    .footer {
      margin-top: 15px;
      font-size: 10px;
    }
    
    .small-text {
      font-size: 9px;
      margin-top: 5px;
    }
    
    @media print {
      body {
        background: white;
        padding: 0;
        margin: 0;
      }
      
      .toolbar {
        display: none;
      }
      
      .print-container {
        box-shadow: none;
        border-radius: 0;
      }
      
      .receipt-wrapper {
        padding: 0;
      }
    }
    
    @media (max-width: 600px) {
      body {
        padding: 10px;
      }
      
      .toolbar {
        flex-direction: column;
      }
      
      .toolbar-buttons {
        width: 100%;
      }
      
      .toolbar button {
        flex: 1;
      }
    }
  `;
}

// Helper method to escape HTML
private escapeHtml(str: string): string {
  if (!str) return '';
  return str
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

// Helper method to format Taka
private formatTk(amount: number): string {
  if (isNaN(amount)) return '0 TK';
  return amount.toFixed(2).replace(/\.00$/, '') + ' TK';
}
  generateReceipt(): void {
    this.receiptHTML = this.receiptService.buildThermalReceiptHTML(this.receiptData);
  }

  printReceipt(): void {
    this.receiptService.printReceipt(this.receiptHTML);
  }

  updateItem(index: number, field: keyof ReceiptItem, value: any): void {
    // Update item
    //this.receiptData.itemsDetailed[index][field] = value;
    
    // Recalculate item total
    const item = this.receiptData.itemsDetailed[index];
    item.total = item.quantity * item.unitPrice;
    
    // Update receipt service and regenerate
    this.receiptService.updateReceiptData({ itemsDetailed: this.receiptData.itemsDetailed });
    this.receiptData = this.receiptService.getReceiptData();
    this.generateReceipt();
  }

  addNewItem(): void {
    this.receiptData.itemsDetailed.push({
      name: 'New Item',
      quantity: 1,
      unitPrice: 0,
      total: 0
    });
    this.receiptService.updateReceiptData({ itemsDetailed: this.receiptData.itemsDetailed });
    this.receiptData = this.receiptService.getReceiptData();
    this.generateReceipt();
  }

  removeItem(index: number): void {
    this.receiptData.itemsDetailed.splice(index, 1);
    this.receiptService.updateReceiptData({ itemsDetailed: this.receiptData.itemsDetailed });
    this.receiptData = this.receiptService.getReceiptData();
    this.generateReceipt();
  }

  updateReceiptField(field: keyof ReceiptData, value: any): void {
    this.receiptService.updateReceiptData({ [field]: value });
    this.receiptData = this.receiptService.getReceiptData();
    this.generateReceipt();
  }
}
