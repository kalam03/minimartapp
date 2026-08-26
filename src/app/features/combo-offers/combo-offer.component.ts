import { Component, OnInit, ChangeDetectorRef } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { TranslocoModule, TranslocoService, provideTranslocoScope } from '@jsverse/transloco';
import { ComboOfferService, ComboOffer, SaveComboOfferItemRequest } from '../../services/combo-offer.service';
import { ProductService } from '../../services/product.service';
import { Product } from '../../models/product';
import { AlertService } from '../../shared/alert.service';
import { resolveMediaUrl } from '../../shared/media-url';

@Component({
  selector: 'app-combo-offer',
  standalone: true,
  imports: [CommonModule, FormsModule, TranslocoModule],
  providers: [provideTranslocoScope('comboOffers')],
  templateUrl: './combo-offer.component.html',
})
export class ComboOfferComponent implements OnInit {
  combos: ComboOffer[] = [];
  products: Product[] = [];
  isSaving = false;
  searchText = '';
  Math = Math;
  resolveMediaUrl = resolveMediaUrl;

  // Picked in the form but uploaded separately, after the combo itself is created/updated — mirrors
  // product.component.ts's picker (see combo-offer.service.ts's uploadImage()).
  selectedImageFile: File | null = null;
  imagePreviewUrl: string | null = null;

  //Client-side pagination, list is small enough not to need a server round trip per page
  pageSize = 10;
  currentPage = 1;
  //Client-side Active/Inactive filter, applied on top of the search text
  statusFilter: '' | 'active' | 'inactive' = '';

  readonly emptyForm = {
    comboName: '',
    comboType: 'FixedDiscount' as 'FixedDiscount' | 'PercentageDiscount' | 'FixedPrice',
    discountValue: null as number | null,
    fixedComboPrice: null as number | null,
    startDate: this.today(),
    endDate: this.today(),
    priority: 0,
    isActive: true,
    description: '' as string,
  };

  form = { ...this.emptyForm };
  items: SaveComboOfferItemRequest[] = [];
  validationErrors: Record<string, string> = {};
  editingId: number | null = null;

  get filteredCombos(): ComboOffer[] {
    const q = this.searchText.trim().toLowerCase();
    return this.combos.filter(c => {
      const matchesSearch = !q || c.comboName.toLowerCase().includes(q);
      const matchesStatus =
        !this.statusFilter ||
        (this.statusFilter === 'active' ? c.isActive : !c.isActive);
      return matchesSearch && matchesStatus;
    });
  }

  //Current page slice of filteredCombos, what the table actually renders
  get pagedCombos(): ComboOffer[] {
    const start = (this.currentPage - 1) * this.pageSize;
    return this.filteredCombos.slice(start, start + this.pageSize);
  }

  get totalPages(): number {
    return Math.ceil(this.filteredCombos.length / this.pageSize) || 1;
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

  //"Buy X, get Y free" combos are discounted purely by the free line's own value, so Combo Type/Discount Value/Bundle Price become irrelevant
  get anyFreeItem(): boolean {
    return this.items.some(i => i.isFreeItem);
  }

  hasFreeItem(c: ComboOffer): boolean {
    return c.items.some(i => i.isFreeItem);
  }

  constructor(
    private service: ComboOfferService,
    private productService: ProductService,
    private alertService: AlertService,
    private cdr: ChangeDetectorRef,
    private transloco: TranslocoService
  ) {}

  private t(key: string, params?: Record<string, unknown>): string {
    return this.transloco.translate(`comboOffers.${key}`, params);
  }

  private today(): string {
    return new Date().toISOString().slice(0, 10);
  }

  ngOnInit(): void {
    this.load();
    //Unwraps { success, data } — ProductService's Product[] return type is incorrect (see PromotionDiscountComponent)
    this.productService.getAllProducts({ isActive: true }).subscribe({
      next: (response: any) => (this.products = Array.isArray(response) ? response : response?.data || []),
      error: () => {}
    });
  }

  load(): void {
    this.service.getAll().subscribe({
      next: (res) => {
        this.combos = res.data || [];
        this.currentPage = 1;
        //Manual change detection so the grid paints as soon as the list arrives (app-wide convention)
        this.cdr.detectChanges();
      },
      error: (err: any) => this.alertService.error(this.t('messages.loadError', { error: err.error?.message || err.message }))
    });
  }

  productName(id: number): string {
    return this.products.find(p => p.productId === id)?.productName || '';
  }

  addLine(): void {
    this.items.push({ productId: this.products[0]?.productId || 0, requiredQty: 1, isFreeItem: false });
  }

  removeLine(index: number): void {
    this.items.splice(index, 1);
  }

  validateForm(): boolean {
    this.validationErrors = {};

    if (!this.form.comboName.trim())
      this.validationErrors['comboName'] = this.t('validation.nameRequired');
    if (this.items.length < 2)
      this.validationErrors['items'] = this.t('validation.needTwoLines');
    if (new Date(this.form.endDate) < new Date(this.form.startDate))
      this.validationErrors['endDate'] = this.t('validation.endBeforeStart');

    //Free-item combos skip Combo Type/Discount Value/Bundle Price validation (irrelevant for them)
    if (!this.anyFreeItem) {
      if (this.form.comboType === 'FixedPrice' && (!this.form.fixedComboPrice || this.form.fixedComboPrice <= 0))
        this.validationErrors['fixedComboPrice'] = this.t('validation.fixedPriceRequired');
      if (this.form.comboType !== 'FixedPrice' && (!this.form.discountValue || this.form.discountValue <= 0))
        this.validationErrors['discountValue'] = this.t('validation.discountValueRequired');
      if (this.form.comboType === 'PercentageDiscount' && (this.form.discountValue || 0) > 100)
        this.validationErrors['discountValue'] = this.t('validation.percentTooHigh');
    }

    return Object.keys(this.validationErrors).length === 0;
  }

  isFieldInvalid(field: string): boolean {
    return !!this.validationErrors[field];
  }

  onImageSelected(event: Event): void {
    const input = event.target as HTMLInputElement;
    const file = input.files?.[0] ?? null;
    if (!file) return;

    if (!/^image\/(png|jpe?g|webp)$/i.test(file.type)) {
      this.alertService.error(this.t('messages.imageTypeInvalid'));
      input.value = '';
      return;
    }
    if (file.size > 5 * 1024 * 1024) {
      this.alertService.error(this.t('messages.imageTooLarge'));
      input.value = '';
      return;
    }

    if (this.imagePreviewUrl?.startsWith('blob:')) URL.revokeObjectURL(this.imagePreviewUrl);
    this.selectedImageFile = file;
    this.imagePreviewUrl = URL.createObjectURL(file);
  }

  private finishSaveWithImage(comboId: number, file: File | null): void {
    if (!file) {
      this.load();
      return;
    }
    this.service.uploadImage(comboId, file).subscribe({
      next: () => this.load(),
      error: (err: any) => {
        this.alertService.error(this.t('messages.imageUploadError', { error: err.error?.message || err.message }));
        this.load();
      }
    });
  }

  save(): void {
    if (!this.validateForm()) return;
    this.isSaving = true;

    const payload = { ...this.form, description: this.form.description.trim() || null, items: this.items };
    const editingId = this.editingId;
    const pendingImageFile = this.selectedImageFile;
    const obs = editingId ? this.service.update(editingId, payload) : this.service.create(payload);

    obs.subscribe({
      next: (res: any) => {
        this.isSaving = false;
        this.alertService.success(res.message || this.t(editingId ? 'messages.updateSuccess' : 'messages.createSuccess'));
        const savedId = editingId ?? res?.data?.comboId;
        this.resetForm();
        if (savedId) this.finishSaveWithImage(savedId, pendingImageFile);
        else this.load();
      },
      error: (err: any) => {
        this.isSaving = false;
        this.alertService.error(this.t('messages.saveError', { error: err.error?.message || err.message }));
      }
    });
  }

  edit(c: ComboOffer): void {
    this.editingId = c.comboId;
    this.form = {
      comboName: c.comboName,
      comboType: c.comboType,
      discountValue: c.discountValue,
      fixedComboPrice: c.fixedComboPrice,
      startDate: c.startDate.slice(0, 10),
      endDate: c.endDate.slice(0, 10),
      priority: c.priority,
      isActive: c.isActive,
      description: c.description || '',
    };
    this.items = c.items.map(i => ({ productId: i.productId, requiredQty: i.requiredQty, isFreeItem: i.isFreeItem }));
    if (this.imagePreviewUrl?.startsWith('blob:')) URL.revokeObjectURL(this.imagePreviewUrl);
    this.selectedImageFile = null;
    this.imagePreviewUrl = resolveMediaUrl(c.imageUrl);
    this.validationErrors = {};
    window.scrollTo({ top: 0, behavior: 'smooth' });
  }

  async remove(c: ComboOffer): Promise<void> {
    const confirmed = await this.alertService.confirm(
      this.t('messages.deleteConfirm', { name: c.comboName }),
      this.t('messages.deleteTitle')
    );
    if (!confirmed) return;

    this.service.delete(c.comboId).subscribe({
      next: () => { this.alertService.success(this.t('messages.deleteSuccess')); this.load(); },
      error: (err: any) => this.alertService.error(this.t('messages.actionFailed', { error: err.error?.message || err.message }))
    });
  }

  resetForm(): void {
    this.editingId = null;
    this.form = { ...this.emptyForm };
    this.items = [];
    if (this.imagePreviewUrl?.startsWith('blob:')) URL.revokeObjectURL(this.imagePreviewUrl);
    this.selectedImageFile = null;
    this.imagePreviewUrl = null;
    this.validationErrors = {};
  }
}
