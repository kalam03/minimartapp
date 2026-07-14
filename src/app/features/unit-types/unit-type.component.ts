import { Component, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { TranslocoModule, TranslocoService, provideTranslocoScope } from '@jsverse/transloco';
import { UnitTypeService, UnitType } from '../../services/unit-type.service';
import { AlertService } from '../../shared/alert.service';

@Component({
  selector: 'app-unit-type',
  standalone: true,
  imports: [CommonModule, FormsModule, TranslocoModule],
  // Loads assets/i18n/unitTypes/{en,bn}.json only when this route is hit.
  providers: [provideTranslocoScope('unitTypes')],
  templateUrl: './unit-type.component.html',
  styleUrls: ['./unit-type.component.css']
})
export class UnitTypeComponent implements OnInit {
  unitTypes: UnitType[] = [];
  isSaving = false;
  searchText = '';

  readonly emptyForm = {
    unitCode: '',
    unitName: '',
    isWeight: false,
    isActive: true,
  };

  form = { ...this.emptyForm };
  validationErrors: Record<string, string> = {};

  /** Set while editing an existing row; null while adding a new one */
  editingId: number | null = null;

  get filteredUnitTypes(): UnitType[] {
    const q = this.searchText.trim().toLowerCase();
    if (!q) return this.unitTypes;
    return this.unitTypes.filter(u =>
      u.unitCode.toLowerCase().includes(q) ||
      u.unitName.toLowerCase().includes(q)
    );
  }

  constructor(
    private unitTypeService: UnitTypeService,
    private alertService: AlertService,
    private transloco: TranslocoService
  ) {}

  /** Shorthand for the 'unitTypes' scope — see provideTranslocoScope above. */
  private t(key: string, params?: Record<string, unknown>): string {
    return this.transloco.translate(`unitTypes.${key}`, params);
  }

  ngOnInit(): void {
    this.loadUnitTypes();
  }

  loadUnitTypes(): void {
    this.unitTypeService.getAllUnitTypes().subscribe({
      next: (res) => {
        this.unitTypes = res.data || [];
      },
      error: (err: any) => {
        this.alertService.error(this.t('messages.loadError', { error: err.error?.message || err.message }));
      }
    });
  }

  validateForm(): boolean {
    this.validationErrors = {};

    if (!this.form.unitCode.trim())
      this.validationErrors['unitCode'] = this.t('validation.codeRequired');
    else if (!/^[A-Za-z0-9._-]{1,10}$/.test(this.form.unitCode.trim()))
      this.validationErrors['unitCode'] = this.t('validation.codeFormat');

    if (!this.form.unitName.trim())
      this.validationErrors['unitName'] = this.t('validation.nameRequired');

    const dupe = this.unitTypes.find(u =>
      u.unitCode.toLowerCase() === this.form.unitCode.trim().toLowerCase() &&
      u.unitTypeId !== this.editingId
    );
    if (dupe) this.validationErrors['unitCode'] = this.t('validation.codeDuplicate');

    return Object.keys(this.validationErrors).length === 0;
  }

  isFieldInvalid(field: string): boolean {
    return !!this.validationErrors[field];
  }

  saveUnitType(): void {
    if (!this.validateForm()) return;

    this.isSaving = true;

    if (this.editingId) {
      this.unitTypeService.updateUnitType(this.editingId, {
        unitCode: this.form.unitCode.trim().toUpperCase(),
        unitName: this.form.unitName.trim(),
        isWeight: this.form.isWeight,
        isActive: this.form.isActive,
      }).subscribe({
        next: (res) => {
          this.isSaving = false;
          this.alertService.success(res.message || this.t('messages.updateSuccess'));
          this.resetForm();
          this.loadUnitTypes();
        },
        error: (err: any) => {
          this.isSaving = false;
          this.alertService.error(this.t('messages.updateError', { error: err.error?.message || err.message }));
        }
      });
      return;
    }

    this.unitTypeService.createUnitType({
      unitCode: this.form.unitCode.trim().toUpperCase(),
      unitName: this.form.unitName.trim(),
      isWeight: this.form.isWeight,
    }).subscribe({
      next: (res) => {
        this.isSaving = false;
        this.alertService.success(res.message || this.t('messages.createSuccess'));
        this.resetForm();
        this.loadUnitTypes();
      },
      error: (err: any) => {
        this.isSaving = false;
        this.alertService.error(this.t('messages.createError', { error: err.error?.message || err.message }));
      }
    });
  }

  editUnitType(u: UnitType): void {
    this.editingId = u.unitTypeId;
    this.form = {
      unitCode: u.unitCode,
      unitName: u.unitName,
      isWeight: u.isWeight,
      isActive: u.isActive,
    };
    this.validationErrors = {};
  }

  async toggleActive(u: UnitType): Promise<void> {
    const confirmed = await this.alertService.confirm(
      this.t(u.isActive ? 'messages.deactivateConfirm' : 'messages.reactivateConfirm', { name: u.unitName }),
      this.t(u.isActive ? 'messages.deactivateTitle' : 'messages.reactivateTitle')
    );
    if (!confirmed) return;

    if (u.isActive) {
      this.unitTypeService.deleteUnitType(u.unitTypeId).subscribe({
        next: () => { this.alertService.success(this.t('messages.deactivateSuccess')); this.loadUnitTypes(); },
        error: (err: any) => this.alertService.error(this.t('messages.actionFailed', { error: err.error?.message || err.message }))
      });
    } else {
      this.unitTypeService.updateUnitType(u.unitTypeId, {
        unitCode: u.unitCode,
        unitName: u.unitName,
        isWeight: u.isWeight,
        isActive: true,
      }).subscribe({
        next: () => { this.alertService.success(this.t('messages.reactivateSuccess')); this.loadUnitTypes(); },
        error: (err: any) => this.alertService.error(this.t('messages.actionFailed', { error: err.error?.message || err.message }))
      });
    }
  }

  resetForm(): void {
    this.editingId = null;
    this.form = { ...this.emptyForm };
    this.validationErrors = {};
  }
}
