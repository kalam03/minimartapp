import { Component, HostListener, OnInit, ElementRef, ViewChild } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { ProductService } from '../../services/product.service';
import { Product, ProductFilter } from '../../models/product';

export interface Customer {
  id: number;
  name: string;
  email: string;
  phone: string;
  address: string;
  loyaltyPoints: number;
}

export interface CartItem {
  product: Product;
  quantity: number;
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
  imports: [CommonModule, FormsModule],
  templateUrl: './pos-billing.html',
  styleUrls: ['./pos-billing.css']
})
export class PosBillingComponent implements OnInit {
  constructor(private productService: ProductService) {}
  Math = Math;

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
  customers: Customer[] = [
    { id: 1, name: 'John Doe', email: 'john@example.com', phone: '+1 234 567 8900', address: '123 Main St, NY', loyaltyPoints: 450 },
    { id: 2, name: 'Jane Smith', email: 'jane@example.com', phone: '+1 234 567 8901', address: '456 Oak Ave, LA', loyaltyPoints: 780 },
    { id: 3, name: 'Mike Johnson', email: 'mike@example.com', phone: '+1 234 567 8902', address: '789 Pine Rd, TX', loyaltyPoints: 230 },
    { id: 4, name: 'Sarah Williams', email: 'sarah@example.com', phone: '+1 234 567 8903', address: '321 Elm St, FL', loyaltyPoints: 1200 },
    { id: 5, name: 'David Brown', email: 'david@example.com', phone: '+1 234 567 8904', address: '654 Maple Dr, WA', loyaltyPoints: 95 }
  ];

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
    categoryId: null
  };

  ngOnInit(): void {
    this.loadProducts();
    this.loadSampleInvoices();
  }

  loadProducts(): void {
    this.productService.getAllProducts(this.filters).subscribe({
      next: (data) => {
        this.products = data;
        console.log('Products loaded:', this.products);
      },
      error: (err: any) => {
        console.error('Error loading products:', err);
      }
    });
  }

  loadSampleInvoices(): void {
    // Sample invoice data
    this.invoices = [
      {
        invoiceNo: 'INV-001',
        customerName: 'John Doe',
        totalAmount: 150.00,
        discountAmount: 10.00,
        grossAmount: 140.00,
        date: new Date().toLocaleDateString()
      },
      {
        invoiceNo: 'INV-002',
        customerName: 'Jane Smith',
        totalAmount: 250.00,
        discountAmount: 25.00,
        grossAmount: 225.00,
        date: new Date().toLocaleDateString()
      }
    ];
  }

  onProductSearch(term: string): void {
    this.searchProductTerm = term;
    this.showProductDropdown = term.length > 0;
    this.selectedProductIndex = -1;
    
    if (term.length > 0 && this.filteredProducts.length > 0) {
      const exactMatch = this.filteredProducts.find(product => 
        product.productName?.toLowerCase() === term.toLowerCase()
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
        this.selectedProductIndex = Math.min(this.selectedProductIndex + 1, this.filteredProducts.length - 1);
        this.scrollToSelectedProduct();
        break;
      
      case 'ArrowUp':
        event.preventDefault();
        this.selectedProductIndex = Math.max(this.selectedProductIndex - 1, -1);
        this.scrollToSelectedProduct();
        break;
      
      case 'Enter':
        event.preventDefault();
        if (this.selectedProductIndex >= 0 && this.selectedProductIndex < this.filteredProducts.length) {
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
    
    if (term.length > 0 && this.filteredCustomers.length > 0) {
      const exactMatch = this.filteredCustomers.find(customer => 
        customer.name.toLowerCase() === term.toLowerCase() ||
        customer.phone === term
      );
      
      if (exactMatch) {
        this.selectCustomer(exactMatch);
      }
    }
  }

  onCustomerKeydown(event: KeyboardEvent): void {
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
        this.selectedCustomerIndex = Math.min(this.selectedCustomerIndex + 1, this.filteredCustomers.length - 1);
        this.scrollToSelectedCustomer();
        break;
      
      case 'ArrowUp':
        event.preventDefault();
        this.selectedCustomerIndex = Math.max(this.selectedCustomerIndex - 1, -1);
        this.scrollToSelectedCustomer();
        break;
      
      case 'Enter':
        event.preventDefault();
        if (this.selectedCustomerIndex >= 0 && this.selectedCustomerIndex < this.filteredCustomers.length) {
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

  selectBestMatchProduct(): void {
    if (this.searchProductTerm.length === 0) return;
    
    const term = this.searchProductTerm.toLowerCase();
    
    let bestMatch = this.products.find(product => 
      product.productName?.toLowerCase() === term
    );
    
    if (!bestMatch) {
      bestMatch = this.products.find(product => 
        product.productName?.toLowerCase().startsWith(term)
      );
    }
    
    if (!bestMatch) {
      bestMatch = this.products.find(product => 
        product.productName?.toLowerCase().includes(term)
      );
    }
    
    if (bestMatch) {
      this.selectProduct(bestMatch);
    }
  }

  selectBestMatchCustomer(): void {
    if (this.searchCustomerTerm.length === 0) return;
    
    const term = this.searchCustomerTerm.toLowerCase();
    
    let bestMatch = this.customers.find(customer => 
      customer.name.toLowerCase() === term || customer.phone === this.searchCustomerTerm
    );
    
    if (!bestMatch) {
      bestMatch = this.customers.find(customer => 
        customer.name.toLowerCase().startsWith(term)
      );
    }
    
    if (!bestMatch) {
      bestMatch = this.customers.find(customer => 
        customer.name.toLowerCase().includes(term)
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

  scrollToSelectedCustomer(): void {
    setTimeout(() => {
      const selectedElement = document.querySelector('.customer-dropdown-item.selected');
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
    this.selectedCustomerId = customer.id;
    this.searchCustomerTerm = customer.name;
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
    switch(value) {
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
    return this.products.filter(product => 
      product.productName?.toLowerCase().includes(term) ||
      product.categoryName?.toLowerCase().includes(term) ||
      product.barcode?.toLowerCase().includes(term)
    ).slice(0, 10);
  }

  // Filtered Customers
  get filteredCustomers(): Customer[] {
    if (!this.searchCustomerTerm) return [];
    return this.customers.filter(customer =>
      customer.name.toLowerCase().includes(this.searchCustomerTerm.toLowerCase()) ||
      customer.email.toLowerCase().includes(this.searchCustomerTerm.toLowerCase()) ||
      customer.phone.includes(this.searchCustomerTerm)
    ).slice(0, 10);
  }

  // Get Selected Customer
  get selectedCustomer(): Customer | undefined {
    return this.customers.find(c => c.id === this.selectedCustomerId);
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
  addToCart(): void {
    if (!this.selectedProduct) {
      alert('Please select a product');
      setTimeout(() => {
        if (this.productSearchInput) {
          this.productSearchInput.nativeElement.focus();
        }
      }, 0);
      return;
    }

    const product = this.selectedProduct;
    
    if (this.productQuantity > product.stockQty) {
      alert(`Only ${product.stockQty} items available in stock`);
      return;
    }

    const existingItem = this.cartItems.find(item => item.product.productId === product.productId);
    
    if (existingItem) {
      const newQuantity = existingItem.quantity + this.productQuantity;
      if (newQuantity > product.stockQty) {
        alert(`Only ${product.stockQty} items available in stock`);
        return;
      }
      existingItem.quantity = newQuantity;
      existingItem.subtotal = existingItem.quantity * product.salePrice;
    } else {
      this.cartItems.push({
        product: product,
        quantity: this.productQuantity,
        subtotal: this.productQuantity * product.salePrice
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
      gross: this.grossAmount
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
  submitBill(): void {
    if (this.cartItems.length === 0) {
      alert('Cart is empty. Please add items to continue.');
      return;
    }
    
    if (!this.selectedCustomerId) {
      alert('Please select a customer.');
      return;
    }

    if (this.dueAmount > 0) {
      alert(`Warning: There is an outstanding due of $${this.dueAmount.toFixed(2)}. Please collect full payment.`);
      return;
    }

    if (this.paymentCash < this.grossAmount) {
      alert(`Insufficient payment. Please pay $${this.grossAmount.toFixed(2)} or more.`);
      return;
    }

    const newInvoice: Invoice = {
      invoiceNo: 'INV-' + Date.now(),
      customerName: this.selectedCustomer?.name || '',
      totalAmount: this.subtotal,
      discountAmount: this.discountAmount,
      grossAmount: this.grossAmount,
      date: new Date().toLocaleDateString()
    };

    this.invoices.unshift(newInvoice);

    const receipt = {
      invoiceNo: newInvoice.invoiceNo,
      date: new Date(),
      customer: this.selectedCustomer,
      items: this.cartItems,
      subtotal: this.subtotal,
      discount: this.discountAmount,
      discountPercent: this.discountPercent,
      transportCost: this.transportCost,
      transportType: this.transportType,
      grossAmount: this.grossAmount,
      paymentMethod: this.selectedPaymentMethod,
      paymentAmount: this.paymentCash,
      returnAmount: this.returnCash
    };

const receipt1 = {
      invoiceNo: newInvoice.invoiceNo,
      saleDate: new Date(),
      customerId:this.selectedCustomer?.id,
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




    console.log('Bill Submitted for api:', receipt1);
    console.log('Bill Submitted:', receipt);
    alert(`Bill Submitted Successfully!\nInvoice: ${newInvoice.invoiceNo}\nTotal: $${this.grossAmount.toFixed(2)}\nPayment: $${this.paymentCash.toFixed(2)}\nReturn: $${this.returnCash.toFixed(2)}`);
    
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
  viewInvoice(invoice: Invoice): void {
    alert(`Invoice Details:\nNumber: ${invoice.invoiceNo}\nCustomer: ${invoice.customerName}\nTotal: $${invoice.totalAmount}\nDiscount: $${invoice.discountAmount}\nGross: $${invoice.grossAmount}\nDate: ${invoice.date}`);
  }

  // Print invoice
  printInvoice(invoice: Invoice): void {
    console.log('Printing invoice:', invoice);
    alert(`Printing invoice ${invoice.invoiceNo}`);
  }

}