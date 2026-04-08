import { Component, HostListener, OnInit } from '@angular/core';
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

@Component({
  selector: 'app-pos-billing',  // ✅ Make sure selector matches
  standalone: true,
  imports: [CommonModule, FormsModule],
  templateUrl: './pos-billing.html',  // ✅ Check file name
  styleUrls: ['./pos-billing.css']
})
export class PosBillingComponent implements OnInit {
  constructor(private productService: ProductService) {}
  Math = Math;

  // UI State
  showProductDropdown: boolean = false;
  showCustomerDropdown: boolean = false;

  // Products Data
  products: Product[] = [];

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
  tax: number = 0;
  discount: number = 0;
  total: number = 0;
  taxRate: number = 0.10; // 10% tax
  
  // UI State
  searchProductTerm: string = '';
  searchCustomerTerm: string = '';
  selectedPaymentMethod: string = 'cash';

  ngOnInit(): void {
    this.loadProducts();
    this.calculateTotals();
  }
    filters: ProductFilter = {
    tenantId: null,
    isActive: true,
    categoryId: null
  };
  loadProducts(): void {
  
    this.productService.getAllProducts(this.filters).subscribe({
      next: (data) => {
        this.products = data;
        console.log('Products loaded:', this.products);
      },
      error: (err:any) => {
        console.error('Error loading products:', err);
        
      }
    });
  }
 
    onProductSearch(term: string) {
    this.searchProductTerm = term;
    this.showProductDropdown = term.length > 0;
  }

  selectProduct(product: any) {
    this.selectProduct = product;
    this.selectedProductId = product.productId;
    this.searchProductTerm = product.productName;
    this.showProductDropdown = false;
  }


  onCustomerSearch(term: string) {
    this.searchCustomerTerm = term;
    this.showCustomerDropdown = term.length > 0;
  }

  selectCustomer(customer: any) {
    this.selectedCustomerId = customer.id;
    this.searchCustomerTerm = customer.name;
    this.showCustomerDropdown = false;
  }

  resetProduct() {
    this.selectedProductId = null;
    this.searchProductTerm = '';
    this.productQuantity = 1;
  }
    @HostListener('document:click', ['$event'])
  onClickOutside(event: Event) {
    const target = event.target as HTMLElement;
    if (!target.closest('.relative')) {
      this.showProductDropdown = false;
      this.showCustomerDropdown = false;
    }
  }
  // Filtered Products
get filteredProducts() {
    if (!this.searchProductTerm) return [];
    const term = this.searchProductTerm.toLowerCase();
    return this.products.filter(product => 
      product.productName?.toLowerCase().includes(term) ||
      product.categoryName?.toLowerCase().includes(term) ||
      product.barcode?.toLowerCase().includes(term)
    );
  }

  // Filtered Customers
  get filteredCustomers(): Customer[] {
    return this.customers.filter(customer =>
      customer.name.toLowerCase().includes(this.searchCustomerTerm.toLowerCase()) ||
      customer.email.toLowerCase().includes(this.searchCustomerTerm.toLowerCase()) ||
      customer.phone.includes(this.searchCustomerTerm)
    );
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

  // Helper method for discount
  onDiscountChange(value: string | number): void {
    const numValue = typeof value === 'string' ? parseFloat(value) : value;
    this.discount = isNaN(numValue) ? 0 : numValue;
    this.applyDiscount();
  }

  // Add Product to Cart
  addToCart(): void {
    if (!this.selectedProductId) {
      alert('Please select a product');
      return;
    }

    const product = this.products.find(p => p.productId === this.selectedProductId);
    if (!product) return;

    const existingItem = this.cartItems.find(item => item.product.productId === product.productId);
    
    if (existingItem) {
      existingItem.quantity += this.productQuantity;
            existingItem.subtotal = existingItem.quantity * product.salePrice;
    } else {
      this.cartItems.push({
        product: product,
        quantity: this.productQuantity,
        subtotal: this.productQuantity * product.salePrice
      });
    }

    this.calculateTotals();
    this.selectedProductId = null;
    this.productQuantity = 1;
  }

  // Update Cart Item Quantity
  updateQuantity(item: CartItem, newQuantity: number): void {
    if (newQuantity < 1) {
      this.removeFromCart(item);
      return;
    }
    
    if (newQuantity > item.product.stockQty) {
      alert(`Only ${item.product.stockQty} items available in stock`);
      return;
    }
    
    item.quantity = newQuantity;
    item.subtotal = item.quantity * item.product.salePrice;
    this.calculateTotals();
  }

  // Remove from Cart
  removeFromCart(item: CartItem): void {
    const index = this.cartItems.indexOf(item);
    if (index > -1) {
      this.cartItems.splice(index, 1);
      this.calculateTotals();
    }
  }

  // Apply Discount
  applyDiscount(): void {
    if (this.selectedCustomer && this.discount > 0) {
      const maxDiscount = this.selectedCustomer.loyaltyPoints / 10;
      if (this.discount > maxDiscount) {
        alert(`Maximum discount for this customer is $${maxDiscount.toFixed(2)}`);
        this.discount = maxDiscount;
      }
    }
    this.calculateTotals();
  }

  // Calculate Totals
  calculateTotals(): void {
    this.subtotal = this.cartItems.reduce((sum, item) => sum + item.subtotal, 0);
    this.tax = this.subtotal * this.taxRate;
    
    if (this.discount > this.subtotal) {
      this.discount = this.subtotal;
    }
    
    this.total = this.subtotal + this.tax - this.discount;
  }

  // Clear Cart
  clearCart(): void {
    if (confirm('Are you sure you want to clear the cart?')) {
      this.cartItems = [];
      this.discount = 0;
      this.calculateTotals();
    }
  }

  // Process Payment
  processPayment(): void {
    if (this.cartItems.length === 0) {
      alert('Cart is empty. Please add items to continue.');
      return;
    }
    
    if (!this.selectedCustomerId) {
      alert('Please select a customer.');
      return;
    }

    const receipt = {
      invoiceNo: 'INV-' + Date.now(),
      date: new Date(),
      customer: this.selectedCustomer,
      items: this.cartItems,
      subtotal: this.subtotal,
      tax: this.tax,
      discount: this.discount,
      total: this.total,
      paymentMethod: this.selectedPaymentMethod
    };

    console.log('Payment Processed:', receipt);
    alert(`Payment Successful!\nTotal: $${this.total.toFixed(2)}\nInvoice: ${receipt.invoiceNo}`);
    
    // Reset after payment
    this.cartItems = [];
    this.selectedCustomerId = null;
    this.discount = 0;
    this.calculateTotals();
  }


}