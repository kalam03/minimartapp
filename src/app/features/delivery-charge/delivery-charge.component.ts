import { Component, OnInit, ChangeDetectorRef } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { TranslocoModule, TranslocoService, provideTranslocoScope } from '@jsverse/transloco';
import {
  DeliveryChargeService, DeliveryZone, DeliveryCustomerRate, DeliveryCategorySurcharge
} from '../../services/delivery-charge.service';
import { CustomerService, Customer } from '../../services/customer.service';
import { CategoryService, Category } from '../../services/category.service';
import { AlertService } from '../../shared/alert.service';

type Tab = 'zones' | 'customerRates' | 'categorySurcharges';

@Component({
  selector: 'app-delivery-charge',
  standalone: true,
  imports: [CommonModule, FormsModule, TranslocoModule],
  providers: [provideTranslocoScope('deliveryCharge')],
  templateUrl: './delivery-charge.component.html',
})
export class DeliveryChargeComponent implements OnInit {
  activeTab: Tab = 'zones';
  isSaving = false;

  // ── Zones ────────────────────────────────────────────────────────────
  zones: DeliveryZone[] = [];
  readonly emptyZoneForm = { zoneName: '', charge: 0, displayOrder: 0, isActive: true };
  zoneForm = { ...this.emptyZoneForm };
  editingZoneId: number | null = null;
  zoneValidationErrors: Record<string, string> = {};

  // ── Customer rates ──────────────────────────────────────────────────
  customerRates: DeliveryCustomerRate[] = [];
  customers: Customer[] = [];
  readonly emptyCustomerRateForm = { customerId: null as number | null, isFree: false, charge: 0, notes: '', isActive: true };
  customerRateForm = { ...this.emptyCustomerRateForm };
  editingCustomerRateId: number | null = null;
  customerRateValidationErrors: Record<string, string> = {};

  // ── Category surcharges ─────────────────────────────────────────────
  categorySurcharges: DeliveryCategorySurcharge[] = [];
  categories: Category[] = [];
  readonly emptyCategorySurchargeForm = { categoryId: null as number | null, surchargeAmount: 0, isActive: true };
  categorySurchargeForm = { ...this.emptyCategorySurchargeForm };
  editingCategorySurchargeId: number | null = null;
  categorySurchargeValidationErrors: Record<string, string> = {};

  constructor(
    private service: DeliveryChargeService,
    private customerService: CustomerService,
    private categoryService: CategoryService,
    private alertService: AlertService,
    private cdr: ChangeDetectorRef,
    private transloco: TranslocoService
  ) {}

  private t(key: string, params?: Record<string, unknown>): string {
    return this.transloco.translate(`deliveryCharge.${key}`, params);
  }

  ngOnInit(): void {
    this.loadZones();
    this.loadCustomerRates();
    this.loadCategorySurcharges();

    this.customerService.getAllCustomers().subscribe({
      next: (res: any) => (this.customers = Array.isArray(res) ? res : res?.data || []),
      error: () => {}
    });
    this.categoryService.getAllCategories(true).subscribe({
      next: (res: any) => (this.categories = Array.isArray(res) ? res : res?.data || []),
      error: () => {}
    });
  }

  setTab(tab: Tab): void {
    this.activeTab = tab;
  }

  // ── Zones ────────────────────────────────────────────────────────────
  loadZones(): void {
    this.service.getZones().subscribe({
      next: (res) => { this.zones = res.data || []; this.cdr.detectChanges(); },
      error: (err: any) => this.alertService.error(this.t('messages.loadError', { error: err.error?.message || err.message }))
    });
  }

  validateZoneForm(): boolean {
    this.zoneValidationErrors = {};
    if (!this.zoneForm.zoneName.trim()) this.zoneValidationErrors['zoneName'] = this.t('validation.zoneNameRequired');
    if (this.zoneForm.charge < 0) this.zoneValidationErrors['charge'] = this.t('validation.chargeNonNegative');
    return Object.keys(this.zoneValidationErrors).length === 0;
  }

  saveZone(): void {
    if (!this.validateZoneForm()) return;
    this.isSaving = true;
    const payload = { ...this.zoneForm };
    const obs = this.editingZoneId ? this.service.updateZone(this.editingZoneId, payload) : this.service.createZone(payload);
    obs.subscribe({
      next: (res: any) => {
        this.isSaving = false;
        this.alertService.success(res.message || this.t(this.editingZoneId ? 'messages.updateSuccess' : 'messages.createSuccess'));
        this.resetZoneForm();
        this.loadZones();
      },
      error: (err: any) => { this.isSaving = false; this.alertService.error(this.t('messages.saveError', { error: err.error?.message || err.message })); }
    });
  }

  editZone(z: DeliveryZone): void {
    this.editingZoneId = z.zoneId;
    this.zoneForm = { zoneName: z.zoneName, charge: z.charge, displayOrder: z.displayOrder, isActive: z.isActive };
    this.zoneValidationErrors = {};
  }

  async removeZone(z: DeliveryZone): Promise<void> {
    const confirmed = await this.alertService.confirm(this.t('messages.deleteConfirm', { name: z.zoneName }), this.t('messages.deleteTitle'));
    if (!confirmed) return;
    this.service.deleteZone(z.zoneId).subscribe({
      next: () => { this.alertService.success(this.t('messages.deleteSuccess')); this.loadZones(); },
      error: (err: any) => this.alertService.error(this.t('messages.actionFailed', { error: err.error?.message || err.message }))
    });
  }

  resetZoneForm(): void {
    this.editingZoneId = null;
    this.zoneForm = { ...this.emptyZoneForm };
    this.zoneValidationErrors = {};
  }

  // ── Customer rates ──────────────────────────────────────────────────
  loadCustomerRates(): void {
    this.service.getCustomerRates().subscribe({
      next: (res) => { this.customerRates = res.data || []; this.cdr.detectChanges(); },
      error: (err: any) => this.alertService.error(this.t('messages.loadError', { error: err.error?.message || err.message }))
    });
  }

  validateCustomerRateForm(): boolean {
    this.customerRateValidationErrors = {};
    if (!this.customerRateForm.customerId) this.customerRateValidationErrors['customerId'] = this.t('validation.customerRequired');
    if (!this.customerRateForm.isFree && this.customerRateForm.charge < 0) this.customerRateValidationErrors['charge'] = this.t('validation.chargeNonNegative');
    return Object.keys(this.customerRateValidationErrors).length === 0;
  }

  saveCustomerRate(): void {
    if (!this.validateCustomerRateForm()) return;
    this.isSaving = true;
    const payload = {
      customerId: this.customerRateForm.customerId!,
      isFree: this.customerRateForm.isFree,
      charge: this.customerRateForm.isFree ? 0 : this.customerRateForm.charge,
      notes: this.customerRateForm.notes?.trim() || null,
      isActive: this.customerRateForm.isActive,
    };
    const obs = this.editingCustomerRateId ? this.service.updateCustomerRate(this.editingCustomerRateId, payload) : this.service.createCustomerRate(payload);
    obs.subscribe({
      next: (res: any) => {
        this.isSaving = false;
        this.alertService.success(res.message || this.t(this.editingCustomerRateId ? 'messages.updateSuccess' : 'messages.createSuccess'));
        this.resetCustomerRateForm();
        this.loadCustomerRates();
      },
      error: (err: any) => { this.isSaving = false; this.alertService.error(this.t('messages.saveError', { error: err.error?.message || err.message })); }
    });
  }

  editCustomerRate(r: DeliveryCustomerRate): void {
    this.editingCustomerRateId = r.deliveryCustomerRateId;
    this.customerRateForm = { customerId: r.customerId, isFree: r.isFree, charge: r.charge, notes: r.notes || '', isActive: r.isActive };
    this.customerRateValidationErrors = {};
  }

  async removeCustomerRate(r: DeliveryCustomerRate): Promise<void> {
    const confirmed = await this.alertService.confirm(this.t('messages.deleteConfirm', { name: r.customerName }), this.t('messages.deleteTitle'));
    if (!confirmed) return;
    this.service.deleteCustomerRate(r.deliveryCustomerRateId).subscribe({
      next: () => { this.alertService.success(this.t('messages.deleteSuccess')); this.loadCustomerRates(); },
      error: (err: any) => this.alertService.error(this.t('messages.actionFailed', { error: err.error?.message || err.message }))
    });
  }

  resetCustomerRateForm(): void {
    this.editingCustomerRateId = null;
    this.customerRateForm = { ...this.emptyCustomerRateForm };
    this.customerRateValidationErrors = {};
  }

  // ── Category surcharges ─────────────────────────────────────────────
  loadCategorySurcharges(): void {
    this.service.getCategorySurcharges().subscribe({
      next: (res) => { this.categorySurcharges = res.data || []; this.cdr.detectChanges(); },
      error: (err: any) => this.alertService.error(this.t('messages.loadError', { error: err.error?.message || err.message }))
    });
  }

  validateCategorySurchargeForm(): boolean {
    this.categorySurchargeValidationErrors = {};
    if (!this.categorySurchargeForm.categoryId) this.categorySurchargeValidationErrors['categoryId'] = this.t('validation.categoryRequired');
    if (this.categorySurchargeForm.surchargeAmount < 0) this.categorySurchargeValidationErrors['surchargeAmount'] = this.t('validation.chargeNonNegative');
    return Object.keys(this.categorySurchargeValidationErrors).length === 0;
  }

  saveCategorySurcharge(): void {
    if (!this.validateCategorySurchargeForm()) return;
    this.isSaving = true;
    const payload = {
      categoryId: this.categorySurchargeForm.categoryId!,
      surchargeAmount: this.categorySurchargeForm.surchargeAmount,
      isActive: this.categorySurchargeForm.isActive,
    };
    const obs = this.editingCategorySurchargeId
      ? this.service.updateCategorySurcharge(this.editingCategorySurchargeId, payload)
      : this.service.createCategorySurcharge(payload);
    obs.subscribe({
      next: (res: any) => {
        this.isSaving = false;
        this.alertService.success(res.message || this.t(this.editingCategorySurchargeId ? 'messages.updateSuccess' : 'messages.createSuccess'));
        this.resetCategorySurchargeForm();
        this.loadCategorySurcharges();
      },
      error: (err: any) => { this.isSaving = false; this.alertService.error(this.t('messages.saveError', { error: err.error?.message || err.message })); }
    });
  }

  editCategorySurcharge(s: DeliveryCategorySurcharge): void {
    this.editingCategorySurchargeId = s.deliveryCategorySurchargeId;
    this.categorySurchargeForm = { categoryId: s.categoryId, surchargeAmount: s.surchargeAmount, isActive: s.isActive };
    this.categorySurchargeValidationErrors = {};
  }

  async removeCategorySurcharge(s: DeliveryCategorySurcharge): Promise<void> {
    const confirmed = await this.alertService.confirm(this.t('messages.deleteConfirm', { name: s.categoryName }), this.t('messages.deleteTitle'));
    if (!confirmed) return;
    this.service.deleteCategorySurcharge(s.deliveryCategorySurchargeId).subscribe({
      next: () => { this.alertService.success(this.t('messages.deleteSuccess')); this.loadCategorySurcharges(); },
      error: (err: any) => this.alertService.error(this.t('messages.actionFailed', { error: err.error?.message || err.message }))
    });
  }

  resetCategorySurchargeForm(): void {
    this.editingCategorySurchargeId = null;
    this.categorySurchargeForm = { ...this.emptyCategorySurchargeForm };
    this.categorySurchargeValidationErrors = {};
  }

  customerLabel(c: Customer): string {
    return `${c.customerName} (${c.phone})`;
  }
}
