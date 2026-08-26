import { Component, OnInit, ChangeDetectorRef } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { TranslocoModule, TranslocoService, provideTranslocoScope } from '@jsverse/transloco';
import { CashbackService, CashbackConfig } from '../../services/cashback.service';
import { AlertService } from '../../shared/alert.service';
import { resolveMediaUrl } from '../../shared/media-url';

@Component({
  selector: 'app-cashback-rule',
  standalone: true,
  imports: [CommonModule, FormsModule, TranslocoModule],
  providers: [provideTranslocoScope('cashbackRules')],
  templateUrl: './cashback-rule.component.html',
})
export class CashbackRuleComponent implements OnInit {
  configs: CashbackConfig[] = [];
  isSaving = false;
  searchText = '';
  Math = Math;
  resolveMediaUrl = resolveMediaUrl;

  // Picked in the form but uploaded separately, after the rule itself is created/updated — mirrors
  // product.component.ts's picker (see cashback.service.ts's uploadImage()).
  selectedImageFile: File | null = null;
  imagePreviewUrl: string | null = null;

  //Client-side pagination, list is small enough not to need a server round trip per page
  pageSize = 10;
  currentPage = 1;
  //Client-side Active/Inactive filter, applied on top of the search text
  statusFilter: '' | 'active' | 'inactive' = '';

  readonly emptyForm = {
    configName: '',
    cashbackType: 'Percentage' as 'Percentage' | 'Fixed',
    cashbackValue: 0,
    minPurchaseAmount: 0,
    maxCashbackAmount: null as number | null,
    startDate: this.today(),
    endDate: this.today(),
    priority: 0,
    isActive: true,
    description: '' as string,
  };

  form = { ...this.emptyForm };
  validationErrors: Record<string, string> = {};
  editingId: number | null = null;

  get filteredConfigs(): CashbackConfig[] {
    const q = this.searchText.trim().toLowerCase();
    return this.configs.filter(c => {
      const matchesSearch = !q || c.configName.toLowerCase().includes(q);
      const matchesStatus =
        !this.statusFilter ||
        (this.statusFilter === 'active' ? c.isActive : !c.isActive);
      return matchesSearch && matchesStatus;
    });
  }

  //Current page slice of filteredConfigs, what the table actually renders
  get pagedConfigs(): CashbackConfig[] {
    const start = (this.currentPage - 1) * this.pageSize;
    return this.filteredConfigs.slice(start, start + this.pageSize);
  }

  get totalPages(): number {
    return Math.ceil(this.filteredConfigs.length / this.pageSize) || 1;
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
    private service: CashbackService,
    private alertService: AlertService,
    private cdr: ChangeDetectorRef,
    private transloco: TranslocoService
  ) {}

  private t(key: string, params?: Record<string, unknown>): string {
    return this.transloco.translate(`cashbackRules.${key}`, params);
  }

  private today(): string {
    return new Date().toISOString().slice(0, 10);
  }

  ngOnInit(): void {
    this.load();
  }

  load(): void {
    this.service.getAllConfigs().subscribe({
      next: (res) => {
        this.configs = res.data || [];
        this.currentPage = 1;
        //Manual change detection so the grid paints as soon as the list arrives (app-wide convention)
        this.cdr.detectChanges();
      },
      error: (err: any) => this.alertService.error(this.t('messages.loadError', { error: err.error?.message || err.message }))
    });
  }

  validateForm(): boolean {
    this.validationErrors = {};

    if (!this.form.configName.trim())
      this.validationErrors['configName'] = this.t('validation.nameRequired');
    if (this.form.cashbackValue <= 0)
      this.validationErrors['cashbackValue'] = this.t('validation.valueRequired');
    if (this.form.cashbackType === 'Percentage' && this.form.cashbackValue > 100)
      this.validationErrors['cashbackValue'] = this.t('validation.percentTooHigh');
    if (new Date(this.form.endDate) < new Date(this.form.startDate))
      this.validationErrors['endDate'] = this.t('validation.endBeforeStart');

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

  private finishSaveWithImage(cashbackConfigId: number, file: File | null): void {
    if (!file) {
      this.load();
      return;
    }
    this.service.uploadImage(cashbackConfigId, file).subscribe({
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

    const payload = { ...this.form, description: this.form.description.trim() || null };
    const editingId = this.editingId;
    const pendingImageFile = this.selectedImageFile;
    const obs = editingId ? this.service.updateConfig(editingId, payload) : this.service.createConfig(payload);

    obs.subscribe({
      next: (res: any) => {
        this.isSaving = false;
        this.alertService.success(res.message || this.t(editingId ? 'messages.updateSuccess' : 'messages.createSuccess'));
        const savedId = editingId ?? res?.data?.cashbackConfigId;
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

  edit(c: CashbackConfig): void {
    this.editingId = c.cashbackConfigId;
    this.form = {
      configName: c.configName,
      cashbackType: c.cashbackType,
      cashbackValue: c.cashbackValue,
      minPurchaseAmount: c.minPurchaseAmount,
      maxCashbackAmount: c.maxCashbackAmount,
      startDate: c.startDate.slice(0, 10),
      endDate: c.endDate.slice(0, 10),
      priority: c.priority,
      isActive: c.isActive,
      description: c.description || '',
    };
    if (this.imagePreviewUrl?.startsWith('blob:')) URL.revokeObjectURL(this.imagePreviewUrl);
    this.selectedImageFile = null;
    this.imagePreviewUrl = resolveMediaUrl(c.imageUrl);
    this.validationErrors = {};
    window.scrollTo({ top: 0, behavior: 'smooth' });
  }

  async remove(c: CashbackConfig): Promise<void> {
    const confirmed = await this.alertService.confirm(
      this.t('messages.deleteConfirm', { name: c.configName }),
      this.t('messages.deleteTitle')
    );
    if (!confirmed) return;

    this.service.deleteConfig(c.cashbackConfigId).subscribe({
      next: () => { this.alertService.success(this.t('messages.deleteSuccess')); this.load(); },
      error: (err: any) => this.alertService.error(this.t('messages.actionFailed', { error: err.error?.message || err.message }))
    });
  }

  resetForm(): void {
    this.editingId = null;
    this.form = { ...this.emptyForm };
    if (this.imagePreviewUrl?.startsWith('blob:')) URL.revokeObjectURL(this.imagePreviewUrl);
    this.selectedImageFile = null;
    this.imagePreviewUrl = null;
    this.validationErrors = {};
  }
}
