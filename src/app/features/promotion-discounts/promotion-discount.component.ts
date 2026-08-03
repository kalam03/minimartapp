import { Component, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { TranslocoModule, TranslocoService, provideTranslocoScope } from '@jsverse/transloco';
import { PromotionDiscountService, PromotionMaster } from '../../services/promotion-discount.service';
import { ProductService } from '../../services/product.service';
import { Product } from '../../models/product';
import { AlertService } from '../../shared/alert.service';
import { ProductPickerComponent } from '../../shared/product-picker.component';

@Component({
  selector: 'app-promotion-discount',
  standalone: true,
  imports: [CommonModule, FormsModule, TranslocoModule, ProductPickerComponent],
  providers: [provideTranslocoScope('promotionDiscounts')],
  templateUrl: './promotion-discount.component.html',
})
export class PromotionDiscountComponent implements OnInit {
  promotions: PromotionMaster[] = [];
  products: Product[] = [];
  isSaving = false;
  searchText = '';

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

  get filteredPromotions(): PromotionMaster[] {
    const q = this.searchText.trim().toLowerCase();
    if (!q) return this.promotions;
    return this.promotions.filter(p => p.promotionName.toLowerCase().includes(q));
  }

  constructor(
    private service: PromotionDiscountService,
    private productService: ProductService,
    private alertService: AlertService,
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
    // ProductService.getAllProducts()'s declared return type (Product[]) is
    // wrong — the API actually responds { success, data }, same as every
    // other wrapped endpoint (confirmed against product.component.ts's own
    // Array.isArray(...) ? ... : response.data fallback). Without unwrapping
    // this here, `products` silently became a non-array object and the
    // picker/dropdown rendered nothing.
    this.productService.getAllProducts({ isActive: true }).subscribe({
      next: (response: any) => (this.products = Array.isArray(response) ? response : response?.data || []),
      error: () => {}
    });
  }

  load(): void {
    this.service.getAll().subscribe({
      next: (res) => (this.promotions = res.data || []),
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

  onSelectedIdsChange(ids: number[]): void {
    this.form.productIds = ids;
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
    this.validationErrors = {};
  }
}
