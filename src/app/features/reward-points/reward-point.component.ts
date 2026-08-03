import { Component, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { TranslocoModule, TranslocoService, provideTranslocoScope } from '@jsverse/transloco';
import { RewardPointService, RewardPointConfig } from '../../services/reward-point.service';
import { AlertService } from '../../shared/alert.service';

@Component({
  selector: 'app-reward-point',
  standalone: true,
  imports: [CommonModule, FormsModule, TranslocoModule],
  providers: [provideTranslocoScope('rewardPoints')],
  templateUrl: './reward-point.component.html',
})
export class RewardPointComponent implements OnInit {
  configs: RewardPointConfig[] = [];
  isSaving = false;

  readonly emptyForm = {
    earnAmountPerPoint: 100,
    redeemValuePerPoint: 1,
    minPointsToRedeem: 0,
    maxRedeemAmountPerSale: null as number | null,
    maxRedeemPercentPerSale: null as number | null,
    isActive: true,
    effectiveFrom: this.today(),
    effectiveTo: null as string | null,
  };

  form = { ...this.emptyForm };
  validationErrors: Record<string, string> = {};
  editingId: number | null = null;

  constructor(
    private service: RewardPointService,
    private alertService: AlertService,
    private transloco: TranslocoService
  ) {}

  private t(key: string, params?: Record<string, unknown>): string {
    return this.transloco.translate(`rewardPoints.${key}`, params);
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

    if (this.form.earnAmountPerPoint <= 0)
      this.validationErrors['earnAmountPerPoint'] = this.t('validation.earnAmountRequired');
    if (this.form.redeemValuePerPoint <= 0)
      this.validationErrors['redeemValuePerPoint'] = this.t('validation.redeemValueRequired');
    if (this.form.minPointsToRedeem < 0)
      this.validationErrors['minPointsToRedeem'] = this.t('validation.minPointsInvalid');
    if (this.form.maxRedeemPercentPerSale !== null && (this.form.maxRedeemPercentPerSale < 0 || this.form.maxRedeemPercentPerSale > 100))
      this.validationErrors['maxRedeemPercentPerSale'] = this.t('validation.percentRange');
    if (this.form.effectiveTo && new Date(this.form.effectiveTo) < new Date(this.form.effectiveFrom))
      this.validationErrors['effectiveTo'] = this.t('validation.endBeforeStart');

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

  edit(c: RewardPointConfig): void {
    this.editingId = c.rewardPointConfigId;
    this.form = {
      earnAmountPerPoint: c.earnAmountPerPoint,
      redeemValuePerPoint: c.redeemValuePerPoint,
      minPointsToRedeem: c.minPointsToRedeem,
      maxRedeemAmountPerSale: c.maxRedeemAmountPerSale,
      maxRedeemPercentPerSale: c.maxRedeemPercentPerSale,
      isActive: c.isActive,
      effectiveFrom: c.effectiveFrom.slice(0, 10),
      effectiveTo: c.effectiveTo ? c.effectiveTo.slice(0, 10) : null,
    };
    this.validationErrors = {};
  }

  async remove(c: RewardPointConfig): Promise<void> {
    const confirmed = await this.alertService.confirm(
      this.t('messages.deleteConfirm'),
      this.t('messages.deleteTitle')
    );
    if (!confirmed) return;

    this.service.deleteConfig(c.rewardPointConfigId).subscribe({
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
