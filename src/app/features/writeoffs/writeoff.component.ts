import { Component, OnInit, ChangeDetectorRef } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { TranslocoModule, TranslocoService, provideTranslocoScope } from '@jsverse/transloco';
import { WriteOffService, WriteOff } from '../../services/writeoff.service';
import { ProductService } from '../../services/product.service';
import { Product } from '../../models/product';
import { AlertService } from '../../shared/alert.service';
import { toLocalDateString } from '../../shared/date-utils';

@Component({
  selector: 'app-writeoff',
  standalone: true,
  imports: [CommonModule, FormsModule, TranslocoModule],
  // Loads assets/i18n/writeoffs/{en,bn}.json only when this route is hit.
  providers: [provideTranslocoScope('writeoffs')],
  templateUrl: './writeoff.component.html',
  styleUrls: ['./writeoff.component.css']
})
export class WriteOffComponent implements OnInit {
  Math = Math;

  // Underlying values stay in English — they're persisted to the backend
  // as the write-off's "reason" field. Only the displayed label is
  // translated, via reasonLabelKey() below.
  reasons = ['Damaged', 'Expired', 'Stolen', 'Quality Issue', 'Other'];

  products: Product[] = [];

  form = {
    productId: 0,
    quantity: null as number | null,
    reason: '',
    writeOffDate: toLocalDateString()
  };

  validationErrors: Record<string, string> = {};
  isSaving = false;

  get selectedProduct(): Product | null {
    return this.products.find(p => p.productId === +this.form.productId) ?? null;
  }

  get estimatedValue(): number {
    const p = this.selectedProduct;
    if (!p || !this.form.quantity) return 0;
    return (+this.form.quantity) * (p.purchasePrice || 0);
  }

  // ── Report ─────────────────────────────────────────────────────────
  reportList: WriteOff[] = [];
  reportFromDate = '';
  reportToDate = '';
  reportProductId = 0;
  grandTotalQty = 0;
  grandTotalValue = 0;
  isLoadingReport = false;

  constructor(
    private writeOffService: WriteOffService,
    private productService: ProductService,
    private alertService: AlertService,
    private cdr: ChangeDetectorRef,
    private transloco: TranslocoService
  ) {}

  /** Shorthand for the 'writeoffs' scope — see provideTranslocoScope above. */
  private t(key: string, params?: Record<string, unknown>): string {
    return this.transloco.translate(`writeoffs.${key}`, params);
  }

  /** Maps a stored reason value to its translation key (display only — the
   *  underlying English value is still what's saved/filtered/compared). */
  reasonLabelKey(reason: string): string {
    const map: Record<string, string> = {
      'Damaged': 'reasons.damaged',
      'Expired': 'reasons.expired',
      'Stolen': 'reasons.stolen',
      'Quality Issue': 'reasons.qualityIssue',
      'Other': 'reasons.other'
    };
    return map[reason] ?? reason;
  }

  ngOnInit(): void {
    this.loadProducts();
    this.loadReport();
  }

  loadProducts(): void {
    this.productService.getActiveProducts().subscribe({
      next: (res: any) => {
        this.products = Array.isArray(res) ? res : (res?.data ?? []);
        this.cdr.detectChanges();
      },
      error: () => {}
    });
  }

  validateForm(): boolean {
    this.validationErrors = {};
    if (!+this.form.productId)
      this.validationErrors['productId'] = this.t('validation.productRequired');
    if (!this.form.quantity || +this.form.quantity <= 0)
      this.validationErrors['quantity'] = this.t('validation.quantityRequired');
    if (this.selectedProduct && this.form.quantity && +this.form.quantity > this.selectedProduct.stockQty)
      this.validationErrors['quantity'] = this.t('validation.quantityExceedsStock', {
        stock: this.selectedProduct.stockQty,
        unit: this.selectedProduct.unitType
      });
    if (!this.form.reason.trim())
      this.validationErrors['reason'] = this.t('validation.reasonRequired');
    return Object.keys(this.validationErrors).length === 0;
  }

  isFieldInvalid(field: string): boolean {
    return !!this.validationErrors[field];
  }

  saveWriteOff(): void {
    if (!this.validateForm()) return;

    const productName = this.selectedProduct?.productName ?? '';
    this.alertService
      .confirm(
        this.t('messages.confirmBody', {
          quantity: this.form.quantity,
          unit: this.selectedProduct?.unitType,
          name: productName,
          value: '৳ ' + this.estimatedValue.toFixed(2)
        }),
        this.t('messages.confirmTitle'),
        this.t('messages.confirmDestroy'),
        this.t('messages.confirmCancel')
      )
      .then((confirmed: boolean) => {
        if (!confirmed) return;

        this.isSaving = true;
        this.writeOffService
          .createWriteOff({
            productId: +this.form.productId,
            quantity: +this.form.quantity!,
            reason: this.form.reason,
            writeOffDate: this.form.writeOffDate
          })
          .subscribe({
            next: (res: any) => {
              this.isSaving = false;
              this.alertService.success(res.message || this.t('messages.writeOffSuccess'));
              this.resetForm();
              this.loadProducts();
              this.loadReport();
            },
            error: (err: any) => {
              this.isSaving = false;
              this.alertService.error(this.t('messages.writeOffError', { error: err.error?.message || err.message }));
            }
          });
      });
  }

  resetForm(): void {
    this.form = {
      productId: 0,
      quantity: null,
      reason: '',
      writeOffDate: toLocalDateString()
    };
    this.validationErrors = {};
  }

  // ── Report ─────────────────────────────────────────────────────────
  loadReport(): void {
    this.isLoadingReport = true;
    this.writeOffService
      .getReport(this.reportFromDate || undefined, this.reportToDate || undefined, this.reportProductId || undefined)
      .subscribe({
        next: (res) => {
          this.reportList = res.data;
          this.grandTotalQty = res.grandTotalQty;
          this.grandTotalValue = res.grandTotalValue;
          this.isLoadingReport = false;
          this.cdr.detectChanges();
        },
        error: () => {
          this.isLoadingReport = false;
        }
      });
  }

  applyReportFilters(): void {
    this.loadReport();
  }

  resetReportFilters(): void {
    this.reportFromDate = '';
    this.reportToDate = '';
    this.reportProductId = 0;
    this.loadReport();
  }
}
