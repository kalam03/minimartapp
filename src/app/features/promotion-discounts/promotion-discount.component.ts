import { Component, OnInit, ChangeDetectorRef } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { TranslocoModule, TranslocoService, provideTranslocoScope } from '@jsverse/transloco';
import { PromotionDiscountService, PromotionMaster } from '../../services/promotion-discount.service';
import { ProductService } from '../../services/product.service';
import { Product } from '../../models/product';
import { AlertService } from '../../shared/alert.service';

@Component({
  selector: 'app-promotion-discount',
  standalone: true,
  imports: [CommonModule, FormsModule, TranslocoModule],
  providers: [provideTranslocoScope('promotionDiscounts')],
  templateUrl: './promotion-discount.component.html',
})
export class PromotionDiscountComponent implements OnInit {
  promotions: PromotionMaster[] = [];
  products: Product[] = [];
  isSaving = false;
  searchText = '';
  Math = Math;

  //Client-side pagination, list is small enough not to need a server round trip per page
  pageSize = 10;
  currentPage = 1;
  //Client-side Active/Inactive filter, applied on top of the search text
  statusFilter: '' | 'active' | 'inactive' = '';

  readonly emptyForm = {
    promotionName: '',
    discountType: 'Percentage' as 'Percentage' | 'Fixed',
    discountValue: 0,
    appliesToAll: false,
    startDate: this.today(),
    endDate: this.today(),
    priority: 0,
    isActive: true,
    productIds: [] as number[],
  };

  form = { ...this.emptyForm, productIds: [] as number[] };
  validationErrors: Record<string, string> = {};
  editingId: number | null = null;

  //Product picked in the "add one product at a time" dropdown, below the grid of already-added products
  selectedProductToAdd: number | null = null;

  //Products not yet added to this discount, what the add-dropdown offers
  get availableProductsToAdd(): Product[] {
    return this.products.filter(p => !this.form.productIds.includes(p.productId));
  }

  get filteredPromotions(): PromotionMaster[] {
    const q = this.searchText.trim().toLowerCase();
    return this.promotions.filter(p => {
      const matchesSearch = !q || p.promotionName.toLowerCase().includes(q);
      const matchesStatus =
        !this.statusFilter ||
        (this.statusFilter === 'active' ? p.isActive : !p.isActive);
      return matchesSearch && matchesStatus;
    });
  }

  //Current page slice of filteredPromotions, what the table actually renders
  get pagedPromotions(): PromotionMaster[] {
    const start = (this.currentPage - 1) * this.pageSize;
    return this.filteredPromotions.slice(start, start + this.pageSize);
  }

  get totalPages(): number {
    return Math.ceil(this.filteredPromotions.length / this.pageSize) || 1;
  }

  nextPage(): void {
    if (this.currentPage < this.totalPages) this.currentPage++;
  }

  prevPage(): void {
    if (this.currentPage > 1) this.currentPage--;
  }

  goToPage(page: number): void {
    if (page >= 1 && page <= this.totalPages) this.currentPage = page;
  }

  constructor(
    private service: PromotionDiscountService,
    private productService: ProductService,
    private alertService: AlertService,
    private cdr: ChangeDetectorRef,
    private transloco: TranslocoService
  ) {}

  private t(key: string, params?: Record<string, unknown>): string {
    return this.transloco.translate(`promotionDiscounts.${key}`, params);
  }

  private today(): string {
    return new Date().toISOString().slice(0, 10);
  }

  ngOnInit(): void {
    this.load();
    //ProductService.getAllProducts()'s declared return type (Product[]) is wrong — API actually responds { success, data }, so unwrap it here or products silently becomes a non-array
    this.productService.getAllProducts({ isActive: true }).subscribe({
      next: (response: any) => (this.products = Array.isArray(response) ? response : response?.data || []),
      error: () => {}
    });
  }

  load(): void {
    this.service.getAll().subscribe({
      next: (res) => {
        this.promotions = res.data || [];
        this.currentPage = 1;
        //Manual change detection so the grid paints as soon as the list arrives (app-wide convention)
        this.cdr.detectChanges();
      },
      error: (err: any) => this.alertService.error(this.t('messages.loadError', { error: err.error?.message || err.message }))
    });
  }

  validateForm(): boolean {
    this.validationErrors = {};

    if (!this.form.promotionName.trim())
      this.validationErrors['promotionName'] = this.t('validation.nameRequired');
    if (this.form.discountValue <= 0)
      this.validationErrors['discountValue'] = this.t('validation.valueRequired');
    if (this.form.discountType === 'Percentage' && this.form.discountValue > 100)
      this.validationErrors['discountValue'] = this.t('validation.percentTooHigh');
    if (new Date(this.form.endDate) < new Date(this.form.startDate))
      this.validationErrors['endDate'] = this.t('validation.endBeforeStart');
    if (!this.form.appliesToAll && this.form.productIds.length === 0)
      this.validationErrors['productIds'] = this.t('validation.productsRequired');

    return Object.keys(this.validationErrors).length === 0;
  }

  isFieldInvalid(field: string): boolean {
    return !!this.validationErrors[field];
  }

  //Selecting an option in the product dropdown adds it straight to the grid, no separate Add button
  onProductPicked(productId: number | null): void {
    if (productId == null) return;
    if (!this.form.productIds.includes(productId)) {
      this.form.productIds = [...this.form.productIds, productId];
    }
    this.selectedProductToAdd = null;
  }

  removeProductFromDiscount(productId: number): void {
    this.form.productIds = this.form.productIds.filter(id => id !== productId);
  }

  productName(id: number): string {
    return this.products.find(p => p.productId === id)?.productName || `#${id}`;
  }

  //Comma-joined product names for a discount's "Scope" column in the list table
  productNames(ids: number[]): string {
    return ids.map(id => this.productName(id)).join(', ');
  }

  save(): void {
    if (!this.validateForm()) return;
    this.isSaving = true;

    const payload = { ...this.form };
    const obs = this.editingId ? this.service.update(this.editingId, payload) : this.service.create(payload);

    obs.subscribe({
      next: (res: any) => {
        this.isSaving = false;
        this.alertService.success(res.message || this.t(this.editingId ? 'messages.updateSuccess' : 'messages.createSuccess'));
        this.resetForm();
        this.load();
      },
      error: (err: any) => {
        this.isSaving = false;
        this.alertService.error(this.t('messages.saveError', { error: err.error?.message || err.message }));
      }
    });
  }

  edit(p: PromotionMaster): void {
    this.editingId = p.promotionId;
    this.form = {
      promotionName: p.promotionName,
      discountType: p.discountType,
      discountValue: p.discountValue,
      appliesToAll: p.appliesToAll,
      startDate: p.startDate.slice(0, 10),
      endDate: p.endDate.slice(0, 10),
      priority: p.priority,
      isActive: p.isActive,
      productIds: [...p.productIds],
    };
    this.validationErrors = {};
  }

  async remove(p: PromotionMaster): Promise<void> {
    const confirmed = await this.alertService.confirm(
      this.t('messages.deleteConfirm', { name: p.promotionName }),
      this.t('messages.deleteTitle')
    );
    if (!confirmed) return;

    this.service.delete(p.promotionId).subscribe({
      next: () => { this.alertService.success(this.t('messages.deleteSuccess')); this.load(); },
      error: (err: any) => this.alertService.error(this.t('messages.actionFailed', { error: err.error?.message || err.message }))
    });
  }

  resetForm(): void {
    this.editingId = null;
    this.form = { ...this.emptyForm, productIds: [] };
    this.selectedProductToAdd = null;
    this.validationErrors = {};
  }
}
