import { Component, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { UnitTypeService, UnitType } from '../../services/unit-type.service';
import { AlertService } from '../../shared/alert.service';

@Component({
  selector: 'app-unit-type',
  standalone: true,
  imports: [CommonModule, FormsModule],
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
    private alertService: AlertService
  ) {}

  ngOnInit(): void {
    this.loadUnitTypes();
  }

  loadUnitTypes(): void {
    this.unitTypeService.getAllUnitTypes().subscribe({
      next: (res) => {
        this.unitTypes = res.data || [];
      },
      error: (err: any) => {
        this.alertService.error('Failed to load unit types: ' + (err.error?.message || err.message));
      }
    });
  }

  validateForm(): boolean {
    this.validationErrors = {};

    if (!this.form.unitCode.trim())
      this.validationErrors['unitCode'] = 'Unit code is required';
    else if (!/^[A-Za-z0-9._-]{1,10}$/.test(this.form.unitCode.trim()))
      this.validationErrors['unitCode'] = 'Use up to 10 letters/numbers, e.g. PCS, KG, DOZ';

    if (!this.form.unitName.trim())
      this.validationErrors['unitName'] = 'Unit name is required';

    const dupe = this.unitTypes.find(u =>
      u.unitCode.toLowerCase() === this.form.unitCode.trim().toLowerCase() &&
      u.unitTypeId !== this.editingId
    );
    if (dupe) this.validationErrors['unitCode'] = 'This unit code is already registered';

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
          this.alertService.success(res.message || 'Unit type updated successfully!');
          this.resetForm();
          this.loadUnitTypes();
        },
        error: (err: any) => {
          this.isSaving = false;
          this.alertService.error('Failed to update unit type: ' + (err.error?.message || err.message));
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
        this.alertService.success(res.message || 'Unit type added successfully!');
        this.resetForm();
        this.loadUnitTypes();
      },
      error: (err: any) => {
        this.isSaving = false;
        this.alertService.error('Failed to add unit type: ' + (err.error?.message || err.message));
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
    const action = u.isActive ? 'deactivate' : 'reactivate';
    const confirmed = await this.alertService.confirm(
      `Are you sure you want to ${action} "${u.unitName}"?`,
      u.isActive ? 'Deactivate Unit Type' : 'Reactivate Unit Type'
    );
    if (!confirmed) return;

    if (u.isActive) {
      this.unitTypeService.deleteUnitType(u.unitTypeId).subscribe({
        next: () => { this.alertService.success('Unit type deactivated.'); this.loadUnitTypes(); },
        error: (err: any) => this.alertService.error('Failed: ' + (err.error?.message || err.message))
      });
    } else {
      this.unitTypeService.updateUnitType(u.unitTypeId, {
        unitCode: u.unitCode,
        unitName: u.unitName,
        isWeight: u.isWeight,
        isActive: true,
      }).subscribe({
        next: () => { this.alertService.success('Unit type reactivated.'); this.loadUnitTypes(); },
        error: (err: any) => this.alertService.error('Failed: ' + (err.error?.message || err.message))
      });
    }
  }

  resetForm(): void {
    this.editingId = null;
    this.form = { ...this.emptyForm };
    this.validationErrors = {};
  }
}
