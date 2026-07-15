import { Component, OnInit, ChangeDetectorRef } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { TranslocoModule, TranslocoService, provideTranslocoScope } from '@jsverse/transloco';
import { CapitalService, DailyCashRegisterRow, CapitalCategoryTotal } from '../../services/capital.service';
import { CustomerService, Customer } from '../../services/customer.service';
import { SupplierService } from '../../services/supplier.service';
import { InvestorService, Investor } from '../../services/investor.service';
import { AlertService } from '../../shared/alert.service';
import { toLocalDateString } from '../../shared/date-utils';
import { BnNumberAccessorDirective } from '../../shared/bn-number-accessor.directive';
import { PAYMENT_METHODS, DEFAULT_PAYMENT_METHOD, paymentMethodLabelKey } from '../../shared/payment-methods';

@Component({
  selector: 'app-capital-management',
  standalone: true,
  imports: [CommonModule, FormsModule, TranslocoModule, BnNumberAccessorDirective],
  // Loads assets/i18n/capital/{en,bn}.json only when this route is hit.
  // Note: txnTypes names and the auto-generated narration text (saved as
  // ledger data) are intentionally left in English — they are persisted
  // business records, not just UI chrome, so translating them would change
  // stored data rather than just the display language. txnMode is different:
  // it's now the same canonical Payment Method list used on every other
  // transaction page (see shared/payment-methods.ts) — only its *displayed*
  // label is translated, the stored value stays the fixed English string.
  providers: [provideTranslocoScope('capital')],
  templateUrl: './capital-management.component.html',
  styleUrls: ['./capital-management.component.css']
})
export class CapitalManagementComponent implements OnInit {

  // ── TXN Types (mirrors TXN_TYPE_MASTER insert) ─────────────────────
  readonly txnTypes = [
    //{ id: 1,  code: 'SALE',       name: 'Sales Transaction',     autoDrCr: 'C' },
    //{ id: 2,  code: 'PURCHASE',   name: 'Purchase Transaction',  autoDrCr: 'D' },
    { id: 3,  code: 'PAYMENT',    name: 'Payment',               autoDrCr: 'D' },
    { id: 4,  code: 'RECEIPT',    name: 'Receipt',               autoDrCr: 'C' },
    { id: 5,  code: 'TRANSFER',   name: 'Fund Transfer',         autoDrCr: ''  },
    { id: 6,  code: 'EXPENSE',    name: 'Expense Entry',         autoDrCr: 'D' },
    { id: 7,  code: 'INCOME',     name: 'Income Entry',          autoDrCr: 'C' },
    { id: 8,  code: 'RETURN',     name: 'Sales/Purchase Return', autoDrCr: ''  },
    { id: 9,  code: 'ADJUSTMENT', name: 'Adjustment Entry',      autoDrCr: ''  },
    { id: 10, code: 'OPENING',    name: 'Opening Balance',       autoDrCr: 'C' },
    { id: 11, code: 'CLOSING',    name: 'Closing Entry',         autoDrCr: 'D' },
    // Refund direction depends on who is refunding whom — a refund TO a customer is
    // money out (Debit), a refund FROM a supplier is money in (Credit) — so it's
    // left user-selectable instead of a fixed direction.
    //{ id: 12, code: 'REFUND',     name: 'Refund Transaction',    autoDrCr: ''  },
    //{ id: 13, code: 'REVERSAL',   name: 'Reversal Transaction',  autoDrCr: ''  },
    //{ id: 14, code: 'SALARY',     name: 'Employee Salary Payment', autoDrCr: 'D' },
    { id: 15, code: 'INVESTMENT', name: 'Investor Investment Received', autoDrCr: 'C' },
  ];

  /** Canonical payment-method options — same list on every page (Payroll/Counter/Purchases/Capital). */
  readonly paymentMethods = PAYMENT_METHODS;
  paymentMethodLabelKey(value: string): string {
    return paymentMethodLabelKey(value);
  }

  // ── Form ─────────────────────────────────────────────────────────────
  // Single Cash Vault model: every entry (manual or auto-posted from
  // Sales/Purchases) shares one named account instead of a per-tenant
  // phone number, so the ledger reads like a real cash book.
  readonly defaultGlAccount = 'CASH VAULT';

  form = {
    txnDate:     toLocalDateString(),
    txnTypeId:   0,
    glAccount:   this.defaultGlAccount,
    drCr:        'C',
    amount:      null as number | null,
    referenceNo: '',
    txnMode:     DEFAULT_PAYMENT_METHOD,
  };
  userNarration  = '';          // user's optional extra note
  isDrCrFixed    = false;
  validationErrors: Record<string, string> = {};

  // ── Party (customer / supplier / investor) ──────────────────────────
  // NOTE: Employee/Salary is no longer selected here — Salary, Bonus and
  // Advance now flow only through the Payroll Management page, which posts
  // to this same GL ledger automatically (see PayrollController).
  customers:        Customer[] = [];
  suppliers:        any[]      = [];
  investors:        Investor[] = [];
  selectedCustomerId  = 0;
  selectedSupplierId  = 0;
  selectedInvestorId  = 0;

  /** REFUND (id=12) can go to a Customer or come from a Supplier — user picks which */
  refundPartyType: '' | 'customer' | 'supplier' = '';

  get selectedCustomer(): Customer | null {
    return this.customers.find(c => c.customerId === +this.selectedCustomerId) ?? null;
  }
  get selectedSupplier(): any | null {
    return this.suppliers.find(s => s.supplierId === +this.selectedSupplierId) ?? null;
  }
  get selectedInvestor(): Investor | null {
    return this.investors.find(i => i.investorId === +this.selectedInvestorId) ?? null;
  }

  get isRefundType(): boolean { return +this.form.txnTypeId === 12; }
  /** SALARY (14) can no longer be entered here — informational only */
  get isSalaryType(): boolean { return +this.form.txnTypeId === 14; }

  /** RECEIPT (4) always needs a customer; REFUND (12) needs one only if refunding a customer */
  get needsCustomer(): boolean {
    return +this.form.txnTypeId === 4 || (this.isRefundType && this.refundPartyType === 'customer');
  }
  /** PAYMENT (3) always needs a supplier; REFUND (12) needs one only if refunding from a supplier */
  get needsSupplier(): boolean {
    return +this.form.txnTypeId === 3 || (this.isRefundType && this.refundPartyType === 'supplier');
  }
  /** INVESTMENT (15) needs an investor */
  get needsInvestor(): boolean { return +this.form.txnTypeId === 15; }
  /** EXPENSE (6) must always carry a real description */
  get needsDescription(): boolean { return +this.form.txnTypeId === 6; }

  // ── Auto-generated narration ─────────────────────────────────────────
  get autoNarration(): string {
    const type   = this.txnTypes.find(t => t.id === +this.form.txnTypeId);
    const amt    = (+this.form.amount! || 0).toFixed(2);
    const gl     = this.form.glAccount || '—';
    const note   = this.userNarration.trim();
    const suffix = note ? `(${note})` : '';

    if (!type) return '';

    switch (type.code) {
      case 'RECEIPT': {
        const name  = this.selectedCustomer?.customerName ?? '';
        const label = name ? `From customer ${name}` : 'From customer';
        return `Received of BDT ${amt} ${label} by selling, Credit to account ${gl}${suffix}`;
      }
      case 'PAYMENT': {
        const name  = this.selectedSupplier?.supplierName ?? '';
        const label = name ? `made to vendor ${name}` : 'made to vendor';
        return `Payment of BDT ${amt} ${label}, debited from account ${gl}${suffix}`;
      }
      case 'SALE':
        return `Sales of BDT ${amt}, Credit to account ${gl}${suffix}`;
      case 'PURCHASE':
        return `Purchase of BDT ${amt}, debited from account ${gl}${suffix}`;
      case 'EXPENSE':
        return `Expense of BDT ${amt}, debited from account ${gl}${suffix}`;
      case 'INCOME':
        return `Income of BDT ${amt}, Credit to account ${gl}${suffix}`;
      case 'TRANSFER': {
        const dir = this.form.drCr === 'C' ? 'Credit to' : 'Debit from';
        return `Fund Transfer of BDT ${amt}, ${dir} account ${gl}${suffix}`;
      }
      case 'RETURN': {
        const dir = this.form.drCr === 'C' ? 'Credit to' : 'Debit from';
        return `Return of BDT ${amt}, ${dir} account ${gl}${suffix}`;
      }
      case 'OPENING':
        return `Opening Balance of BDT ${amt}, Credit to account ${gl}${suffix}`;
      case 'CLOSING':
        return `Closing Entry of BDT ${amt}, debited from account ${gl}${suffix}`;
      case 'REFUND': {
        const dir = this.form.drCr === 'C' ? 'Credit to' : 'Debit from';
        if (this.refundPartyType === 'customer') {
          const name = this.selectedCustomer?.customerName ?? '';
          const label = name ? `to customer ${name}` : 'to customer';
          return `Refund of BDT ${amt} ${label}, ${dir} account ${gl}${suffix}`;
        }
        if (this.refundPartyType === 'supplier') {
          const name = this.selectedSupplier?.supplierName ?? '';
          const label = name ? `from vendor ${name}` : 'from vendor';
          return `Refund of BDT ${amt} ${label}, ${dir} account ${gl}${suffix}`;
        }
        return `Refund of BDT ${amt}, ${dir} account ${gl}${suffix}`;
      }
      case 'SALARY':
        // Salary is no longer submitted from this form — see Payroll page.
        return `Salary payment of BDT ${amt}, debited from account ${gl}${suffix}`;
      case 'INVESTMENT': {
        const name = this.selectedInvestor?.investorName ?? '';
        const label = name ? `from investor ${name}` : 'from investor';
        return `Investment received of BDT ${amt} ${label}, Credit to account ${gl}${suffix}`;
      }
      case 'ADJUSTMENT': {
        const dir = this.form.drCr === 'C' ? 'Credit to' : 'Debit from';
        return `Adjustment of BDT ${amt}, ${dir} account ${gl}${suffix}`;
      }
      case 'REVERSAL': {
        const dir = this.form.drCr === 'C' ? 'Credit to' : 'Debit from';
        return `Reversal of BDT ${amt}, ${dir} account ${gl}${suffix}`;
      }
      default:
        return `${type.name} of BDT ${amt}, account ${gl}${suffix}`;
    }
  }

  // ── Confirm dialog ────────────────────────────────────────────────────
  showConfirm       = false;
  confirmTitle      = '';
  confirmMessage    = '';
  confirmType: 'normal' | 'warning' = 'normal';
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

  get debitExceedsCapital(): boolean {
    return this.form.drCr === 'D' && !!this.form.amount && +this.form.amount > this.netCapital;
  }
  get capitalDepleted(): boolean {
    return this.form.drCr === 'D' && this.netCapital <= 0;
  }

  constructor(
    private capitalService:  CapitalService,
    private customerService: CustomerService,
    private supplierService: SupplierService,
    private investorService: InvestorService,
    private alertService:    AlertService,
    private cdr:             ChangeDetectorRef,
    private transloco:       TranslocoService
  ) {}

  /** Shorthand for the 'capital' scope — see provideTranslocoScope above. */
  private t(key: string, params?: Record<string, unknown>): string {
    return this.transloco.translate(`capital.${key}`, params);
  }

  ngOnInit(): void {
    this.loadCustomers();
    this.loadSuppliers();
    this.loadInvestors();
    this.loadTransactions();
    this.loadPeriodReports();
  }

  loadInvestors(): void {
    this.investorService.getAllInvestors(true).subscribe({
      next: (res) => { this.investors = res.data || []; this.cdr.detectChanges(); },
      error: () => {}
    });
  }

  // ── Period Report: Category Breakdown + Daily Cash Register ─────────
  // One shared date range drives both — "how much per category" and
  // "cash reconciled day by day" are two views of the same period.
  dcrFromDate = toLocalDateString(new Date(new Date().getFullYear(), new Date().getMonth(), 1));
  dcrToDate   = toLocalDateString();

  categoryTotals: CapitalCategoryTotal[] = [];
  isCategoryLoading = false;

  dcrList: DailyCashRegisterRow[] = [];
  dcrOpeningBalance = 0;
  dcrClosingBalance = 0;
  isDcrLoading = false;

  get periodTotalCredit(): number {
    return this.categoryTotals.reduce((sum, c) => sum + c.totalCredit, 0);
  }
  get periodTotalDebit(): number {
    return this.categoryTotals.reduce((sum, c) => sum + c.totalDebit, 0);
  }

  loadPeriodReports(): void {
    this.loadCategoryTotals();
    this.loadDailyCashRegister();
  }

  loadCategoryTotals(): void {
    this.isCategoryLoading = true;
    this.capitalService.getCategoryTotals(this.dcrFromDate, this.dcrToDate).subscribe({
      next: (res) => {
        if (res.success) this.categoryTotals = res.data;
        this.isCategoryLoading = false;
        this.cdr.detectChanges();
      },
      error: () => { this.isCategoryLoading = false; }
    });
  }

  loadDailyCashRegister(): void {
    this.isDcrLoading = true;
    this.capitalService.getDailyCashRegister(this.dcrFromDate, this.dcrToDate).subscribe({
      next: (res) => {
        if (res.success) {
          this.dcrList = res.data;
          this.dcrOpeningBalance = res.openingBalance;
          this.dcrClosingBalance = res.closingBalance;
        }
        this.isDcrLoading = false;
        this.cdr.detectChanges();
      },
      error: () => { this.isDcrLoading = false; }
    });
  }

  applyDcrFilter(): void {
    this.loadPeriodReports();
  }

  resetDcrFilter(): void {
    this.dcrFromDate = toLocalDateString(new Date(new Date().getFullYear(), new Date().getMonth(), 1));
    this.dcrToDate   = toLocalDateString();
    this.loadPeriodReports();
  }

  /** Whether a category card should read as money-in (green) or money-out (orange) */
  isCategoryInflow(c: CapitalCategoryTotal): boolean {
    return c.totalCredit >= c.totalDebit;
  }

  loadCustomers(): void {
    this.customerService.getAllCustomers().subscribe({
      // API returns { success, data: Customer[] } — unwrap it
      next: (res: any) => {
        this.customers = Array.isArray(res) ? res : (res?.data ?? []);
        this.cdr.detectChanges();
      },
      error: () => {}
    });
  }

  loadSuppliers(): void {
    this.supplierService.getAllSuppliers().subscribe({
      next: (res: any) => {
        this.suppliers = Array.isArray(res) ? res : (res?.data ?? []);
      },
      error: () => {}
    });
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
    // Clear party selection when type changes
    this.selectedCustomerId = 0;
    this.selectedSupplierId = 0;
    this.selectedInvestorId = 0;
    this.refundPartyType    = '';
  }

  validateForm(): boolean {
    this.validationErrors = {};
    if (!+this.form.txnTypeId)
      this.validationErrors['txnTypeId'] = this.t('validation.typeRequired');
    if (this.isSalaryType)
      this.validationErrors['txnTypeId'] = this.t('validation.salaryNotAllowed');
    if (!this.form.glAccount.trim())
      this.validationErrors['glAccount'] = this.t('validation.accountRequired');
    if (!this.form.drCr)
      this.validationErrors['drCr'] = this.t('validation.drCrRequired');
    if (!this.form.amount || +this.form.amount <= 0)
      this.validationErrors['amount'] = this.t('validation.amountRequired');

    if (this.isRefundType && !this.refundPartyType)
      this.validationErrors['refundPartyType'] = this.t('validation.refundPartyRequired');
    if (this.needsCustomer && !+this.selectedCustomerId)
      this.validationErrors['customerId'] = this.t('validation.customerRequired');
    if (this.needsSupplier && !+this.selectedSupplierId)
      this.validationErrors['vendorId'] = this.t('validation.supplierRequired');
    if (this.needsInvestor && !+this.selectedInvestorId)
      this.validationErrors['investorId'] = this.t('validation.investorRequired');
    if (this.needsDescription && !this.userNarration.trim())
      this.validationErrors['userNarration'] = this.t('validation.descriptionRequired');

    return Object.keys(this.validationErrors).length === 0;
  }

  saveTransaction(): void {
    if (!this.validateForm()) return;

    if (this.capitalDepleted) {
      this.alertService.warning(this.t('messages.capitalDepletedWarning'));
      return;
    }
    if (this.debitExceedsCapital) {
      this.alertService.warning(
        this.t('messages.debitExceedsWarning', {
          amount: (+this.form.amount!).toLocaleString('en-US', { minimumFractionDigits: 2 }),
          netCapital: this.netCapital.toLocaleString('en-US', { minimumFractionDigits: 2 })
        })
      );
      return;
    }

    const payload = {
      txnTypeId:   +this.form.txnTypeId,
      txnDate:     this.form.txnDate,
      glAccount:   this.form.glAccount.trim(),
      drCr:        this.form.drCr,
      amount:      +this.form.amount!,
      referenceNo: this.form.referenceNo || undefined,
      txnMode:     this.form.txnMode    || undefined,
      narration:   this.autoNarration   || undefined,
      customerId:  this.needsCustomer && +this.selectedCustomerId ? +this.selectedCustomerId : undefined,
      vendorId:    this.needsSupplier && +this.selectedSupplierId ? +this.selectedSupplierId : undefined,
      investorId:  this.needsInvestor && +this.selectedInvestorId ? +this.selectedInvestorId : undefined,
    };

    this._pendingPayload = payload;
    const typeName  = this.txnTypes.find(t => t.id === payload.txnTypeId)?.name ?? '';
    const drcrLabel = payload.drCr === 'D' ? 'Debit (Out)' : 'Credit (In)';

    let partyLine = '';
    if (this.needsCustomer && this.selectedCustomer)
      partyLine = `<br><span class="text-gray-500 text-xs">Customer:</span> <strong>${this.selectedCustomer.customerName} — ${this.selectedCustomer.phone}</strong>`;
    if (this.needsSupplier && this.selectedSupplier)
      partyLine = `<br><span class="text-gray-500 text-xs">Supplier:</span> <strong>${this.selectedSupplier.supplierName} — ${this.selectedSupplier.phone}</strong>`;
    if (this.needsInvestor && this.selectedInvestor)
      partyLine = `<br><span class="text-gray-500 text-xs">Investor:</span> <strong>${this.selectedInvestor.investorName}</strong>`;

    this.confirmTitle   = this.t('confirmModal.title');
    this.confirmMessage =
      `You are about to save a <strong>${drcrLabel}</strong> transaction.<br>` +
      `<br>` +
      `<span class="text-gray-500 text-xs">Type:</span> <strong>${typeName}</strong><br>` +
      `<span class="text-gray-500 text-xs">GL Account:</span> <strong>${payload.glAccount}</strong><br>` +
      `<span class="text-gray-500 text-xs">Amount:</span> <strong>৳${payload.amount.toLocaleString('en-US', { minimumFractionDigits: 2 })}</strong><br>` +
      `<span class="text-gray-500 text-xs">Mode:</span> <strong>${payload.txnMode ?? '-'}</strong>` +
      partyLine +
      `<br><span class="text-gray-500 text-xs">Narration:</span> <em class="text-gray-600">${this.autoNarration}</em>`;
    this.confirmType    = payload.drCr === 'D' ? 'warning' : 'normal';
    this.showConfirm    = true;
  }

  confirmSubmit(): void {
    this.showConfirm = false;
    if (!this._pendingPayload) return;
    this.capitalService.createTransaction(this._pendingPayload).subscribe({
      next: (res: any) => {
        if (res.success) {
          this.alertService.success(this.t('messages.transactionSaved', { txnNo: res.data?.txnNo }));
          this.resetForm();
          this.loadTransactions();
          this.loadPeriodReports();
          this.loadInvestors();
          this.loadCustomers();
          this.loadSuppliers();
        }
        this._pendingPayload = null;
      },
      error: (err: any) => {
        this.alertService.error(this.t('messages.saveError', { error: err.error?.message || err.message }));
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
      txnDate:     toLocalDateString(),
      txnTypeId:   0,
      glAccount:   this.form.glAccount || this.defaultGlAccount,
      drCr:        'C',
      amount:      null,
      referenceNo: '',
      txnMode:     DEFAULT_PAYMENT_METHOD,
    };
    this.userNarration      = '';
    this.selectedCustomerId = 0;
    this.selectedSupplierId = 0;
    this.selectedInvestorId = 0;
    this.refundPartyType    = '';
    this.isDrCrFixed        = false;
    this.validationErrors   = {};
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
