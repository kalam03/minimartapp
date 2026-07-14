import { Component, OnInit, ChangeDetectorRef } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { TranslocoModule, TranslocoService, provideTranslocoScope } from '@jsverse/transloco';
import { SupplierService } from '../../services/supplier.service';
import { AlertService } from '../../shared/alert.service';

@Component({
  selector: 'app-supplier',
  standalone: true,
  imports: [CommonModule, FormsModule, TranslocoModule],
  // Loads assets/i18n/suppliers/{en,bn}.json only when this route is hit —
  // see Multilingual_Localization_Architecture.md Section 5.1. Scope name
  // deliberately has no hyphen (a hyphenated scope name caused all lookups
  // to silently miss — see pos-billing's rename to 'posBilling').
  providers: [provideTranslocoScope('suppliers')],
  templateUrl: './supplier.component.html',
  styleUrls: ['./supplier.component.css']
})
export class SupplierComponent implements OnInit {
  suppliers: any[] = [];
  editingId: number | null = null;
  Math = Math;

  supplierForm = {
    supplierName: '',
    phone: '',
    email: '',
    address: '',
    contactPerson: '',
    contactPersonPhone: '',
    openingBalance: 0.00
  };

  validationErrors = {
    supplierName: '',
    phone: '',
    email: '',
    address: '',
    contactPerson: '',
    contactPersonPhone: '',
    openingBalance: ''
  };

  pageSize = 10;
  currentPage = 1;
  sortBy = 'supplierName';
  sortOrder: 'asc' | 'desc' = 'asc';
  searchText = '';

  constructor(
    private supplierService: SupplierService,
    private alertService: AlertService,
    private cdr: ChangeDetectorRef,
    private transloco: TranslocoService
  ) {}

  /** Shorthand for the 'suppliers' scope — see provideTranslocoScope above. */
  private t(key: string, params?: Record<string, unknown>): string {
    return this.transloco.translate(`suppliers.${key}`, params);
  }

  ngOnInit(): void {
    this.getAllSuppliers();
  }

  validateField(fieldName: string): void {
    const value = (this.supplierForm as any)[fieldName]?.toString().trim() || '';
    this.validationErrors[fieldName as keyof typeof this.validationErrors] = '';

    switch (fieldName) {
      case 'supplierName':
        if (!value) {
          this.validationErrors.supplierName = this.t('validation.nameRequired');
        } else if (value.length < 2) {
          this.validationErrors.supplierName = this.t('validation.nameMinLength');
        } else if (value.length > 100) {
          this.validationErrors.supplierName = this.t('validation.nameMaxLength');
        }
        break;
      case 'phone':
        if (!value) {
          this.validationErrors.phone = this.t('validation.phoneRequired');
        } else if (!/^[0-9]{11}$/.test(value)) {
          this.validationErrors.phone = this.t('validation.phoneInvalid');
        }
        break;
      case 'email':
        if (value && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value)) {
          this.validationErrors.email = this.t('validation.emailInvalid');
        }
        break;
      case 'address':
        if (value && value.length < 2) {
          this.validationErrors.address = this.t('validation.addressMinLength');
        } else if (value.length > 200) {
          this.validationErrors.address = this.t('validation.addressMaxLength');
        }
        break;
      case 'contactPerson':
        if (value && value.length < 2) {
          this.validationErrors.contactPerson = this.t('validation.contactPersonMinLength');
        } else if (value.length > 100) {
          this.validationErrors.contactPerson = this.t('validation.contactPersonMaxLength');
        }
        break;
      case 'contactPersonPhone':
        if (value && !/^[0-9]{11}$/.test(value)) {
          this.validationErrors.contactPersonPhone = this.t('validation.contactPersonPhoneInvalid');
        }
        break;
      case 'openingBalance':
        if (isNaN(Number(value))) {
          this.validationErrors.openingBalance = this.t('validation.openingBalanceInvalid');
        } else if (Number(value) < 0) {
          this.validationErrors.openingBalance = this.t('validation.openingBalanceNegative');
        }
        break;
    }
  }

  validateForm(): boolean {
    Object.keys(this.supplierForm).forEach(field => {
      this.validateField(field);
    });
    return Object.values(this.validationErrors).every(error => !error);
  }

  clearValidationErrors(): void {
    Object.keys(this.validationErrors).forEach(key => {
      this.validationErrors[key as keyof typeof this.validationErrors] = '';
    });
  }

  saveSupplier(): void {
    if (!this.validateForm()) {
      return;
    }

    if (this.editingId) {
      this.updateSupplier();
    } else {
      this.createSupplier();
    }
  }

  createSupplier(): void {
    this.supplierService.createSupplier(this.supplierForm).subscribe({
      next: (response: any) => {
        this.alertService.success(this.t('messages.createSuccess'));
        this.resetForm();
        this.getAllSuppliers();
      },
      error: (err: any) => {
        console.error('Error creating supplier:', err);
        this.alertService.error(this.t('messages.createError', { error: err.error?.message || err.message }));
      }
    });
  }

  editSupplier(supplier: any): void {
    this.editingId = supplier.supplierId;
    this.supplierForm = { ...supplier };
    this.clearValidationErrors();
    window.scrollTo({ top: 0, behavior: 'smooth' });
  }

  updateSupplier(): void {
    if (this.editingId === null) return;

    this.supplierService.updateSupplier(this.editingId, this.supplierForm).subscribe({
      next: (response: any) => {
        this.alertService.success(this.t('messages.updateSuccess'));
        this.resetForm();
        this.editingId = null;
        this.getAllSuppliers();
      },
      error: (err: any) => {
        console.error('Error updating supplier:', err);
        this.alertService.error(this.t('messages.updateError', { error: err.error?.message || err.message }));
      }
    });
  }

  cancelEdit(): void {
    this.resetForm();
    this.editingId = null;
    this.clearValidationErrors();
  }

  deleteSupplier(id: number, name: string): void {
    this.alertService.confirm(this.t('messages.deleteConfirm', { name })).then((confirmed: boolean) => {
      if (confirmed) {
        this.supplierService.deleteSupplier(id).subscribe({
          next: (response: any) => {
            this.alertService.success(this.t('messages.deleteSuccess'));
            this.getAllSuppliers();
          },
          error: (err: any) => {
            console.error('Error deleting supplier:', err);
            this.alertService.error(this.t('messages.deleteError', { error: err.error?.message || err.message }));
          }
        });
      }
    });
  }

  getAllSuppliers(): void {
    this.supplierService.getAllSuppliers().subscribe({
      next: (response: any) => {
        if (response.success === true) {
          this.suppliers = response.data || [];
          this.currentPage = 1;
          this.cdr.detectChanges();
        } else {
          this.suppliers = [];
        }
      },
      error: (err: any) => {
        console.error('Error loading suppliers:', err);
        this.suppliers = [];
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

  get filteredSuppliers(): any[] {
    const q = this.searchText.toLowerCase().trim();
    if (!q) return this.suppliers;
    return this.suppliers.filter(s =>
      (s.supplierName || '').toLowerCase().includes(q) ||
      (s.phone || '').toLowerCase().includes(q) ||
      (s.email || '').toLowerCase().includes(q) ||
      (s.address || '').toLowerCase().includes(q) ||
      (s.contactPerson || '').toLowerCase().includes(q)
    );
  }

  get sortedSuppliers(): any[] {
    const sorted = [...this.filteredSuppliers].sort((a, b) => {
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

  get paginatedSuppliers(): any[] {
    const start = (this.currentPage - 1) * this.pageSize;
    return this.sortedSuppliers.slice(start, start + this.pageSize);
  }

  get totalPages(): number {
    return Math.ceil(this.filteredSuppliers.length / this.pageSize) || 1;
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
    this.supplierForm = {
      supplierName: '',
      phone: '',
      email: '',
      address: '',
      contactPerson: '',
      contactPersonPhone: '',
      openingBalance: 0
    };
    this.clearValidationErrors();
  }

  getSortIcon(column: string): string {
    if (this.sortBy !== column) return '↕';
    return this.sortOrder === 'asc' ? '↑' : '↓';
  }

  onPhoneInput(event: Event, field: 'phone' | 'contactPersonPhone'): void {
    const input = event.target as HTMLInputElement;
    input.value = input.value.replace(/[^0-9]/g, '').slice(0, 11);
    (this.supplierForm as any)[field] = input.value;
  }

  isFieldInvalid(fieldName: string): boolean {
    return !!this.validationErrors[fieldName as keyof typeof this.validationErrors];
  }
}