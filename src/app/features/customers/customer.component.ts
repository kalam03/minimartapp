import { Component, OnInit, ChangeDetectorRef } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { CustomerService } from '../../services/customer.service';
import { AlertService } from '../../shared/alert.service';

@Component({
  selector: 'app-customer',
  standalone: true,
  imports: [CommonModule, FormsModule],
  templateUrl: './customer.component.html',
  styleUrls: ['./customer.component.css']
})
export class CustomerComponent implements OnInit {
  customers: any[] = [];
  editingId: number | null = null;
  Math = Math;

  customerForm = {
    customerName: '',
    phone: '',
    address: '',
    currentBalance: 0.00
  };

  validationErrors = {
    customerName: '',
    phone: '',
    address: '',
    currentBalance: ''
  };

  pageSize = 10;
  currentPage = 1;
  sortBy = 'customerName';
  sortOrder: 'asc' | 'desc' = 'asc';

  constructor(
    private customerService: CustomerService,
    private alertService: AlertService,
    private cdr: ChangeDetectorRef
  ) {}

  ngOnInit(): void {
    this.getAllCustomers();
  }

  validateField(fieldName: string): void {
    const value = (this.customerForm as any)[fieldName]?.toString().trim() || '';
    this.validationErrors[fieldName as keyof typeof this.validationErrors] = '';

    switch (fieldName) {
      case 'customerName':
        if (!value) {
          this.validationErrors.customerName = 'Customer name is required';
        } else if (value.length < 2) {
          this.validationErrors.customerName = 'Customer name must be at least 2 characters';
        } else if (value.length > 100) {
          this.validationErrors.customerName = 'Customer name must not exceed 100 characters';
        }
        break;
      case 'phone':
          if (!value) {
          this.validationErrors.phone = 'Phone number is required';
        }
       else if (value && !/^[0-9\-\+\s]{7,20}$/.test(value)) {
          this.validationErrors.phone = 'Invalid phone format';
        }
        break;
      case 'address':
        if (value && value.length < 2) {
          this.validationErrors.address = 'Address must be at least 2 characters';
        } else if (value.length > 200) {
          this.validationErrors.address = 'Address must not exceed 200 characters';
        }
        break;
      case 'currentBalance':
        if (isNaN(Number(value))) {
          this.validationErrors.currentBalance = 'Balance must be a number';
        } else if (Number(value) < 0) {
          this.validationErrors.currentBalance = 'Balance cannot be negative';
        }
        break;
    }
  }

  validateForm(): boolean {
    Object.keys(this.customerForm).forEach(field => {
      this.validateField(field);
    });
    return Object.values(this.validationErrors).every(error => !error);
  }

  clearValidationErrors(): void {
    Object.keys(this.validationErrors).forEach(key => {
      this.validationErrors[key as keyof typeof this.validationErrors] = '';
    });
  }

  saveCustomer(): void {
    if (!this.validateForm()) {
      return;
    }

    if (this.editingId) {
      this.updateCustomer();
    } else {
      this.createCustomer();
    }
  }

  createCustomer(): void {
    const payload = {
      tenantId: 1,
      ...this.customerForm,
      isActive: true
    };

    this.customerService.createCustomer(payload).subscribe({
      next: (response: any) => {
        this.alertService.success('Customer created successfully!');
        this.resetForm();
        this.getAllCustomers();
      },
      error: (err: any) => {
        console.error('Error creating customer:', err);
        this.alertService.error('Failed to create customer: ' + (err.error?.message || err.message));
      }
    });
  }

  editCustomer(customer: any): void {
    this.editingId = customer.customerId;
    this.customerForm = {
      customerName: customer.customerName,
      phone: customer.phone || '',
      address: customer.address || '',
      currentBalance: customer.currentBalance || 0
    };
    this.clearValidationErrors();
    window.scrollTo({ top: 0, behavior: 'smooth' });
  }

  updateCustomer(): void {
    if (this.editingId === null) return;

    const payload = {
      tenantId: 1,
      ...this.customerForm
    };

    this.customerService.updateCustomer(this.editingId, payload).subscribe({
      next: (response: any) => {
        this.alertService.success('Customer updated successfully!');
        this.resetForm();
        this.editingId = null;
        this.getAllCustomers();
      },
      error: (err: any) => {
        console.error('Error updating customer:', err);
        this.alertService.error('Failed to update customer: ' + (err.error?.message || err.message));
      }
    });
  }

  cancelEdit(): void {
    this.resetForm();
    this.editingId = null;
    this.clearValidationErrors();
  }

  deleteCustomer(id: number, name: string): void {
    this.alertService.confirm(`Are you sure you want to delete "${name}"?`).then((confirmed: boolean) => {
      if (confirmed) {
        this.customerService.deleteCustomer(id, 1).subscribe({
          next: (response: any) => {
            this.alertService.success('Customer deleted successfully!');
            this.getAllCustomers();
          },
          error: (err: any) => {
            console.error('Error deleting customer:', err);
            this.alertService.error('Failed to delete customer: ' + (err.error?.message || err.message));
          }
        });
      }
    });
  }

  getAllCustomers(): void {
    this.customerService.getAllCustomers().subscribe({
      next: (response: any) => {
        this.customers = Array.isArray(response) ? response : response.data || [];
        this.currentPage = 1;
        this.cdr.detectChanges();
      },
      error: (err: any) => {
        console.error('Error loading customers:', err);
        this.customers = [];
        this.alertService.error('Failed to load customers: ' + (err.error?.message || err.message));
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

  get sortedCustomers(): any[] {
    const sorted = [...this.customers].sort((a, b) => {
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

  get paginatedCustomers(): any[] {
    const start = (this.currentPage - 1) * this.pageSize;
    return this.sortedCustomers.slice(start, start + this.pageSize);
  }

  get totalPages(): number {
    return Math.ceil(this.customers.length / this.pageSize);
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
    this.customerForm = {
      customerName: '',
      phone: '',
      address: '',
      currentBalance: 0
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
}
