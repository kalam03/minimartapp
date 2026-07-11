import { Component, OnInit, ChangeDetectorRef } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { WriteOffService, WriteOff } from '../../services/writeoff.service';
import { ProductService } from '../../services/product.service';
import { Product } from '../../models/product';
import { AlertService } from '../../shared/alert.service';
import { toLocalDateString } from '../../shared/date-utils';

@Component({
  selector: 'app-writeoff',
  standalone: true,
  imports: [CommonModule, FormsModule],
  templateUrl: './writeoff.component.html',
  styleUrls: ['./writeoff.component.css']
})
export class WriteOffComponent implements OnInit {
  Math = Math;

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
    private cdr: ChangeDetectorRef
  ) {}

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
      this.validationErrors['productId'] = 'Product is required';
    if (!this.form.quantity || +this.form.quantity <= 0)
      this.validationErrors['quantity'] = 'Quantity must be greater than 0';
    if (this.selectedProduct && this.form.quantity && +this.form.quantity > this.selectedProduct.stockQty)
      this.validationErrors['quantity'] = `Only ${this.selectedProduct.stockQty} ${this.selectedProduct.unitType} in stock`;
    if (!this.form.reason.trim())
      this.validationErrors['reason'] = 'Reason is required';
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
        `Destroy <strong>${this.form.quantity} ${this.selectedProduct?.unitType}</strong> of "${productName}"?<br>` +
          `Estimated loss value: <strong>৳ ${this.estimatedValue.toFixed(2)}</strong>`,
        'Confirm Write-Off',
        'Destroy',
        'Cancel'
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
              this.alertService.success(res.message || 'Write-off logged successfully!');
              this.resetForm();
              this.loadProducts();
              this.loadReport();
            },
            error: (err: any) => {
              this.isSaving = false;
              this.alertService.error('Failed to log write-off: ' + (err.error?.message || err.message));
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
