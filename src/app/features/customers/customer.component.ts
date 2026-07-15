import { Component, OnInit, ChangeDetectorRef } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { TranslocoModule, TranslocoService, provideTranslocoScope } from '@jsverse/transloco';
import { CustomerService } from '../../services/customer.service';
import { AlertService } from '../../shared/alert.service';
import { BnNumberAccessorDirective } from '../../shared/bn-number-accessor.directive';

@Component({
  selector: 'app-customer',
  standalone: true,
  imports: [CommonModule, FormsModule, TranslocoModule, BnNumberAccessorDirective],
  // Loads assets/i18n/customers/{en,bn}.json only when this route is hit.
  providers: [provideTranslocoScope('customers')],
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
  searchText = '';

  constructor(
    private customerService: CustomerService,
    private alertService: AlertService,
    private cdr: ChangeDetectorRef,
    private transloco: TranslocoService
  ) {}

  /** Shorthand for the 'customers' scope — see provideTranslocoScope above. */
  private t(key: string, params?: Record<string, unknown>): string {
    return this.transloco.translate(`customers.${key}`, params);
  }

  ngOnInit(): void {
    this.getAllCustomers();
  }

  validateField(fieldName: string): void {
    const value = (this.customerForm as any)[fieldName]?.toString().trim() || '';
    this.validationErrors[fieldName as keyof typeof this.validationErrors] = '';

    switch (fieldName) {
      case 'customerName':
        if (!value) {
          this.validationErrors.customerName = this.t('validation.nameRequired');
        } else if (value.length < 2) {
          this.validationErrors.customerName = this.t('validation.nameMinLength');
        } else if (value.length > 100) {
          this.validationErrors.customerName = this.t('validation.nameMaxLength');
        }
        break;
      case 'phone':
        if (!value) {
          this.validationErrors.phone = this.t('validation.phoneRequired');
        } else if (!/^[0-9]{11}$/.test(value)) {
          this.validationErrors.phone = this.t('validation.phoneInvalid');
        }
        break;
      case 'address':
        if (value && value.length < 2) {
          this.validationErrors.address = this.t('validation.addressMinLength');
        } else if (value.length > 200) {
          this.validationErrors.address = this.t('validation.addressMaxLength');
        }
        break;
      case 'currentBalance':
        if (isNaN(Number(value))) {
          this.validationErrors.currentBalance = this.t('validation.balanceInvalid');
        } else if (Number(value) < 0) {
          this.validationErrors.currentBalance = this.t('validation.balanceNegative');
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
        this.alertService.success(this.t('messages.createSuccess'));
        this.resetForm();
        this.getAllCustomers();
      },
      error: (err: any) => {
        console.error('Error creating customer:', err);
        this.alertService.error(this.t('messages.createError', { error: err.error?.message || err.message }));
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
        this.alertService.success(this.t('messages.updateSuccess'));
        this.resetForm();
        this.editingId = null;
        this.getAllCustomers();
      },
      error: (err: any) => {
        console.error('Error updating customer:', err);
        this.alertService.error(this.t('messages.updateError', { error: err.error?.message || err.message }));
      }
    });
  }

  cancelEdit(): void {
    this.resetForm();
    this.editingId = null;
    this.clearValidationErrors();
  }

  deleteCustomer(id: number, name: string): void {
    this.alertService.confirm(this.t('messages.deleteConfirm', { name })).then((confirmed: boolean) => {
      if (confirmed) {
        this.customerService.deleteCustomer(id, 1).subscribe({
          next: (response: any) => {
            this.alertService.success(this.t('messages.deleteSuccess'));
            this.getAllCustomers();
          },
          error: (err: any) => {
            console.error('Error deleting customer:', err);
            this.alertService.error(this.t('messages.deleteError', { error: err.error?.message || err.message }));
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
        this.alertService.error(this.t('messages.loadError', { error: err.error?.message || err.message }));
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

  get filteredCustomers(): any[] {
    const q = this.searchText.toLowerCase().trim();
    if (!q) return this.customers;
    return this.customers.filter(c =>
      (c.customerName || '').toLowerCase().includes(q) ||
      (c.phone || '').toLowerCase().includes(q) ||
      (c.address || '').toLowerCase().includes(q)
    );
  }

  get sortedCustomers(): any[] {
    const sorted = [...this.filteredCustomers].sort((a, b) => {
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
    return Math.ceil(this.filteredCustomers.length / this.pageSize) || 1;
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

  onPhoneInput(event: Event): void {
    const input = event.target as HTMLInputElement;
    input.value = input.value.replace(/[^0-9]/g, '').slice(0, 11);
    this.customerForm.phone = input.value;
  }

  isFieldInvalid(fieldName: string): boolean {
    return !!this.validationErrors[fieldName as keyof typeof this.validationErrors];
  }
}
