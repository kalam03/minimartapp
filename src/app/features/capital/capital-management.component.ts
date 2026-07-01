import { Component, OnInit, ChangeDetectorRef } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { CapitalService } from '../../services/capital.service';
import { AlertService } from '../../shared/alert.service';

@Component({
  selector: 'app-capital-management',
  standalone: true,
  imports: [CommonModule, FormsModule],
  templateUrl: './capital-management.component.html',
  styleUrls: ['./capital-management.component.css']
})
export class CapitalManagementComponent implements OnInit {

  // ── TXN Types (mirrors TXN_TYPE_MASTER insert) ─────────────────────
  readonly txnTypes = [
    { id: 1,  code: 'SALE',       name: 'Sales Transaction',     autoDrCr: 'C' },
    { id: 2,  code: 'PURCHASE',   name: 'Purchase Transaction',  autoDrCr: 'D' },
    { id: 3,  code: 'PAYMENT',    name: 'Payment',               autoDrCr: 'D' },
    { id: 4,  code: 'RECEIPT',    name: 'Receipt',               autoDrCr: 'C' },
    { id: 5,  code: 'TRANSFER',   name: 'Fund Transfer',         autoDrCr: ''  },
    { id: 6,  code: 'EXPENSE',    name: 'Expense Entry',         autoDrCr: 'D' },
    { id: 7,  code: 'INCOME',     name: 'Income Entry',          autoDrCr: 'C' },
    { id: 8,  code: 'RETURN',     name: 'Sales/Purchase Return', autoDrCr: ''  },
    { id: 9,  code: 'ADJUSTMENT', name: 'Adjustment Entry',      autoDrCr: ''  },
    { id: 10, code: 'OPENING',    name: 'Opening Balance',       autoDrCr: 'C' },
    { id: 11, code: 'CLOSING',    name: 'Closing Entry',         autoDrCr: 'D' },
    { id: 12, code: 'REFUND',     name: 'Refund Transaction',    autoDrCr: 'C' },
    { id: 13, code: 'REVERSAL',   name: 'Reversal Transaction',  autoDrCr: ''  },
  ];

  readonly txnModes = ['Cash', 'Bank', 'Card', 'Cheque', 'Online Transfer', 'Other'];

  // ── Form ─────────────────────────────────────────────────────────────
  form = {
    txnDate:     new Date().toISOString().split('T')[0],
    txnTypeId:   0,
    glAccount:   '',
    drCr:        'C',
    amount:      null as number | null,
    referenceNo: '',
    txnMode:     'Cash',
    narration:   '',
  };
  isDrCrFixed       = false;
  validationErrors: Record<string, string> = {};

  // ── Confirm dialog ────────────────────────────────────────────────────
  showConfirm       = false;
  confirmTitle      = '';
  confirmMessage    = '';
  confirmType: 'normal' | 'warning' = 'normal';   // 'warning' = orange style
  private _pendingPayload: any = null;

  // ── Transaction list ──────────────────────────────────────────────────
  txnList:       any[]  = [];
  txnTotal              = 0;
  txnPage               = 1;
  txnPageSize           = 20;
  txnSearch             = '';
  txnTypeFilter         = 0;
  txnDrCrFilter         = '';
  txnFromDate           = '';
  txnToDate             = '';
  txnTotalDebit         = 0;
  txnTotalCredit        = 0;
  isLoading             = false;
  Math                  = Math;

  get txnTotalPages(): number { return Math.ceil(this.txnTotal / this.txnPageSize) || 1; }
  get netCapital():    number { return this.txnTotalCredit - this.txnTotalDebit; }

  /** True when the current debit amount would exceed available net capital */
  get debitExceedsCapital(): boolean {
    return this.form.drCr === 'D'
      && !!this.form.amount
      && +this.form.amount > this.netCapital;
  }

  /** True when net capital is zero or negative (no funds at all) */
  get capitalDepleted(): boolean {
    return this.form.drCr === 'D' && this.netCapital <= 0;
  }

  constructor(
    private capitalService: CapitalService,
    private alertService:   AlertService,
    private cdr:            ChangeDetectorRef
  ) {}

  ngOnInit(): void {
    this.loadTransactions();
  }

  // ── Form logic ────────────────────────────────────────────────────────
  onTxnTypeChange(): void {
    const type = this.txnTypes.find(t => t.id === +this.form.txnTypeId);
    if (!type) return;
    if (type.autoDrCr) {
      this.form.drCr   = type.autoDrCr;
      this.isDrCrFixed = true;
    } else {
      this.isDrCrFixed = false;
    }
  }

  validateForm(): boolean {
    this.validationErrors = {};
    if (!+this.form.txnTypeId)
      this.validationErrors['txnTypeId'] = 'Transaction type is required';
    if (!this.form.glAccount.trim())
      this.validationErrors['glAccount'] = 'GL Account is required';
    if (!this.form.drCr)
      this.validationErrors['drCr'] = 'DR/CR is required';
    if (!this.form.amount || +this.form.amount <= 0)
      this.validationErrors['amount'] = 'Amount must be greater than 0';
    return Object.keys(this.validationErrors).length === 0;
  }

  saveTransaction(): void {
    if (!this.validateForm()) return;

    // Hard block: no capital at all
    if (this.capitalDepleted) {
      this.alertService.warning(
        'Insufficient capital! Net capital is ৳0.00. Please add a Credit entry first.'
      );
      return;
    }

    // Hard block: debit amount exceeds available net capital
    if (this.debitExceedsCapital) {
      this.alertService.warning(
        `Debit amount ৳${(+this.form.amount!).toLocaleString('en-US', { minimumFractionDigits: 2 })} ` +
        `exceeds available net capital ৳${this.netCapital.toLocaleString('en-US', { minimumFractionDigits: 2 })}. ` +
        `Transaction restricted.`
      );
      return;
    }

    // Build payload
    const payload = {
      txnTypeId:   +this.form.txnTypeId,
      txnDate:     this.form.txnDate,
      glAccount:   this.form.glAccount.trim(),
      drCr:        this.form.drCr,
      amount:      +this.form.amount!,
      referenceNo: this.form.referenceNo || undefined,
      txnMode:     this.form.txnMode    || undefined,
      narration:   this.form.narration  || undefined,
    };

    // Show confirm dialog
    this._pendingPayload = payload;
    const typeName = this.txnTypes.find(t => t.id === payload.txnTypeId)?.name ?? '';
    const drcrLabel = payload.drCr === 'D' ? 'Debit (Out)' : 'Credit (In)';
    this.confirmTitle   = 'Confirm Transaction';
    this.confirmMessage =
      `You are about to save a <strong>${drcrLabel}</strong> transaction.<br>` +
      `<br>` +
      `<span class="text-gray-500 text-xs">Type:</span> <strong>${typeName}</strong><br>` +
      `<span class="text-gray-500 text-xs">GL Account:</span> <strong>${payload.glAccount}</strong><br>` +
      `<span class="text-gray-500 text-xs">Amount:</span> <strong>৳${payload.amount.toLocaleString('en-US', { minimumFractionDigits: 2 })}</strong><br>` +
      `<span class="text-gray-500 text-xs">Mode:</span> <strong>${payload.txnMode ?? '-'}</strong>`;
    this.confirmType    = payload.drCr === 'D' ? 'warning' : 'normal';
    this.showConfirm    = true;
  }

  confirmSubmit(): void {
    this.showConfirm = false;
    if (!this._pendingPayload) return;
    this.capitalService.createTransaction(this._pendingPayload).subscribe({
      next: (res: any) => {
        if (res.success) {
          this.alertService.success(`Transaction ${res.data?.txnNo} saved successfully!`);
          this.resetForm();
          this.loadTransactions();
        }
        this._pendingPayload = null;
      },
      error: (err: any) => {
        this.alertService.error('Failed to save transaction: ' + (err.error?.message || err.message));
        this._pendingPayload = null;
      }
    });
  }

  cancelConfirm(): void {
    this.showConfirm     = false;
    this._pendingPayload = null;
  }

  resetForm(): void {
    this.form = {
      txnDate:     new Date().toISOString().split('T')[0],
      txnTypeId:   0,
      glAccount:   '',
      drCr:        'C',
      amount:      null,
      referenceNo: '',
      txnMode:     'Cash',
      narration:   '',
    };
    this.isDrCrFixed      = false;
    this.validationErrors = {};
  }

  isFieldInvalid(field: string): boolean {
    return !!this.validationErrors[field];
  }

  // ── Grid ──────────────────────────────────────────────────────────────
  loadTransactions(): void {
    this.isLoading = true;
    this.capitalService.getTransactions(
      this.txnSearch, this.txnDrCrFilter, this.txnTypeFilter,
      this.txnFromDate, this.txnToDate, this.txnPage, this.txnPageSize
    ).subscribe({
      next: (res) => {
        if (res.success) {
          this.txnList        = res.data;
          this.txnTotal       = res.totalCount;
          this.txnTotalDebit  = res.totalDebit;
          this.txnTotalCredit = res.totalCredit;
        }
        this.isLoading = false;
        this.cdr.detectChanges();
      },
      error: () => { this.isLoading = false; }
    });
  }

  applyFilters(): void { this.txnPage = 1; this.loadTransactions(); }

  resetFilters(): void {
    this.txnSearch     = '';
    this.txnDrCrFilter = '';
    this.txnTypeFilter = 0;
    this.txnFromDate   = '';
    this.txnToDate     = '';
    this.txnPage       = 1;
    this.loadTransactions();
  }

  getTxnTypeName(id: number): string {
    return this.txnTypes.find(t => t.id === id)?.name || '-';
  }

  getTxnTypeCode(id: number): string {
    return this.txnTypes.find(t => t.id === id)?.code || '-';
  }
}
