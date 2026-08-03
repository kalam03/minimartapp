import { Component, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { TranslocoModule, TranslocoService, provideTranslocoScope } from '@jsverse/transloco';
import { CashbackService, CashbackConfig } from '../../services/cashback.service';
import { AlertService } from '../../shared/alert.service';

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
  };

  form = { ...this.emptyForm };
  validationErrors: Record<string, string> = {};
  editingId: number | null = null;

  get filteredConfigs(): CashbackConfig[] {
    const q = this.searchText.trim().toLowerCase();
    if (!q) return this.configs;
    return this.configs.filter(c => c.configName.toLowerCase().includes(q));
  }

  constructor(
    private service: CashbackService,
    private alertService: AlertService,
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
      next: (res) => (this.configs = res.data || []),
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

  save(): void {
    if (!this.validateForm()) return;
    this.isSaving = true;

    const payload = { ...this.form };
    const obs = this.editingId ? this.service.updateConfig(this.editingId, payload) : this.service.createConfig(payload);

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
    };
    this.validationErrors = {};
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
    this.validationErrors = {};
  }
}
