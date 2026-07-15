import { Component, OnInit, ChangeDetectorRef } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { TranslocoModule, TranslocoService, provideTranslocoScope } from '@jsverse/transloco';
import { DepartmentService, Department } from '../../services/department.service';
import { DesignationService, Designation } from '../../services/designation.service';
import {
  PayrollService, Employee, EmployeeSalary, Attendance,
  SalaryPayment, EmployeeBonus, EmployeeAdvance, ProcessSalaryPaymentResult
} from '../../services/payroll.service';
import { AlertService } from '../../shared/alert.service';
import { toLocalDateString } from '../../shared/date-utils';
import { BnNumberAccessorDirective } from '../../shared/bn-number-accessor.directive';
import { PAYMENT_METHODS, DEFAULT_PAYMENT_METHOD, paymentMethodLabelKey } from '../../shared/payment-methods';

type Tab = 'employees' | 'salary' | 'attendance' | 'payroll' | 'bonus' | 'advance';

@Component({
  selector: 'app-payroll',
  standalone: true,
  imports: [CommonModule, FormsModule, TranslocoModule, BnNumberAccessorDirective],
  // Loads assets/i18n/payroll/{en,bn}.json only when this route is hit.
  providers: [provideTranslocoScope('payroll')],
  templateUrl: './payroll.component.html',
  styleUrls: ['./payroll.component.css']
})
export class PayrollComponent implements OnInit {

  activeTab: Tab = 'employees';
  // ids stay fixed (used for tab switching logic); displayed labels are
  // looked up via tabLabelKey() below so the underlying id never changes.
  tabs: { id: Tab; label: string }[] = [
    { id: 'employees',  label: 'Employees' },
    { id: 'salary',     label: 'Salary Structure' },
    { id: 'attendance', label: 'Attendance' },
    { id: 'payroll',    label: 'Process Payroll' },
    { id: 'bonus',      label: 'Bonus' },
    { id: 'advance',    label: 'Advance' },
  ];

  tabLabelKey(id: Tab): string {
    return `payroll.tabs.${id}`;
  }

  months = [
    { id: 1, name: 'January' }, { id: 2, name: 'February' }, { id: 3, name: 'March' },
    { id: 4, name: 'April' },   { id: 5, name: 'May' },      { id: 6, name: 'June' },
    { id: 7, name: 'July' },    { id: 8, name: 'August' },   { id: 9, name: 'September' },
    { id: 10, name: 'October' },{ id: 11, name: 'November' },{ id: 12, name: 'December' },
  ];

  // ── Shared master data ────────────────────────────────────────────
  departments: Department[] = [];
  designations: Designation[] = [];
  employees: Employee[] = [];
  isSaving = false;

  /** Canonical payment-method options — same list on every page (Payroll/Counter/Purchases/Capital). */
  readonly paymentMethods = PAYMENT_METHODS;

  get activeEmployees(): Employee[] { return this.employees.filter(e => e.isActive); }

  constructor(
    private payrollService: PayrollService,
    private departmentService: DepartmentService,
    private designationService: DesignationService,
    private alertService: AlertService,
    private cdr: ChangeDetectorRef,
    private transloco: TranslocoService
  ) {}

  /** Shorthand for the 'payroll' scope — see provideTranslocoScope above. */
  private t(key: string, params?: Record<string, unknown>): string {
    return this.transloco.translate(`payroll.${key}`, params);
  }

  // The maps below translate the *displayed* label of a fixed enum value
  // without changing the underlying value that's stored/compared/sent to
  // the backend (gender code, salary type, attendance status, payment
  // method, bonus type all stay in English in the data model).
  genderLabelKey(code: string): string {
    const map: Record<string, string> = { M: 'payroll.options.genderMale', F: 'payroll.options.genderFemale', O: 'payroll.options.genderOther' };
    return map[code] ?? code;
  }
  salaryTypeLabelKey(type: string): string {
    const map: Record<string, string> = { Monthly: 'payroll.options.salaryTypeMonthly', Daily: 'payroll.options.salaryTypeDaily', Hourly: 'payroll.options.salaryTypeHourly' };
    return map[type] ?? type;
  }
  attStatusLabelKey(status: string): string {
    const map: Record<string, string> = { Present: 'payroll.options.statusPresent', Absent: 'payroll.options.statusAbsent', Leave: 'payroll.options.statusLeave' };
    return map[status] ?? status;
  }
  paymentMethodLabelKey(method: string): string {
    return paymentMethodLabelKey(method);
  }
  bonusTypeLabelKey(type: string): string {
    const map: Record<string, string> = {
      'Festival Bonus': 'payroll.options.bonusTypeFestival', 'Performance Bonus': 'payroll.options.bonusTypePerformance',
      'Incentive': 'payroll.options.bonusTypeIncentive', 'Other': 'payroll.options.bonusTypeOther'
    };
    return map[type] ?? type;
  }

  ngOnInit(): void {
    this.loadDepartments();
    this.loadDesignations();
    this.loadEmployees();
  }

  setTab(tab: Tab): void {
    this.activeTab = tab;
    if (tab === 'bonus') this.loadBonuses();
    if (tab === 'advance') this.loadAdvances();
    if (tab === 'payroll') this.loadSalaryPayments();
    if (tab === 'salary' && this.salaryEmployeeId) this.loadSalaryStructure();
    if (tab === 'attendance' && this.attEmployeeId) this.loadAttendance();
  }

  employeeName(id: number | null | undefined): string {
    return this.employees.find(e => e.employeeId === +(id || 0))?.fullName || '-';
  }

  // ══════════════════════════════════════════════════════════════════
  // Departments / Designations (quick-add)
  // ══════════════════════════════════════════════════════════════════
  newDepartmentName = '';
  newDesignationName = '';

  loadDepartments(): void {
    this.departmentService.getAll().subscribe({
      next: (res) => { this.departments = res.data || []; this.cdr.detectChanges(); },
      error: () => {}
    });
  }

  loadDesignations(): void {
    this.designationService.getAll().subscribe({
      next: (res) => { this.designations = res.data || []; this.cdr.detectChanges(); },
      error: () => {}
    });
  }

  addDepartment(): void {
    if (!this.newDepartmentName.trim()) return;
    this.departmentService.create({ departmentName: this.newDepartmentName.trim() }).subscribe({
      next: (res) => {
        this.alertService.success(res.message || this.t('messages.departmentAdded'));
        this.newDepartmentName = '';
        this.loadDepartments();
      },
      error: (err: any) => this.alertService.error(this.t('messages.departmentAddError', { error: err.error?.message || err.message }))
    });
  }

  addDesignation(): void {
    if (!this.newDesignationName.trim()) return;
    this.designationService.create({ designationName: this.newDesignationName.trim() }).subscribe({
      next: (res) => {
        this.alertService.success(res.message || this.t('messages.designationAdded'));
        this.newDesignationName = '';
        this.loadDesignations();
      },
      error: (err: any) => this.alertService.error(this.t('messages.designationAddError', { error: err.error?.message || err.message }))
    });
  }

  // ══════════════════════════════════════════════════════════════════
  // Employees
  // ══════════════════════════════════════════════════════════════════
  empSearch = '';
  empForm = {
    firstName: '', lastName: '', gender: '', mobile: '', email: '',
    presentAddress: '', joiningDate: toLocalDateString(),
    departmentId: null as number | null, designationId: null as number | null,
    salaryType: 'Monthly', basicSalary: null as number | null,
    nidNo: '', bankAccountNo: '', bankName: ''
  };
  empValidationErrors: Record<string, string> = {};
  editingEmployeeId: number | null = null;

  get filteredEmployees(): Employee[] {
    const q = this.empSearch.trim().toLowerCase();
    if (!q) return this.employees;
    return this.employees.filter(e =>
      e.fullName.toLowerCase().includes(q) ||
      (e.employeeCode || '').toLowerCase().includes(q) ||
      (e.mobile || '').includes(q) ||
      (e.designationName || '').toLowerCase().includes(q)
    );
  }

  loadEmployees(): void {
    this.payrollService.getEmployees().subscribe({
      next: (res) => { this.employees = res.data || []; this.cdr.detectChanges(); },
      error: (err: any) => this.alertService.error(this.t('messages.employeesLoadError', { error: err.error?.message || err.message }))
    });
  }

  validateEmpForm(): boolean {
    this.empValidationErrors = {};
    if (!this.empForm.firstName.trim())
      this.empValidationErrors['firstName'] = this.t('validation.firstNameRequired');
    if (!this.empForm.nidNo.trim())
      this.empValidationErrors['nidNo'] = this.t('validation.nidRequired');
    if (!this.empForm.departmentId)
      this.empValidationErrors['departmentId'] = this.t('validation.departmentRequired');
    if (!this.empForm.designationId)
      this.empValidationErrors['designationId'] = this.t('validation.designationRequired');
    if (!this.empForm.gender)
      this.empValidationErrors['gender'] = this.t('validation.genderRequired');
    if (!this.empForm.presentAddress.trim())
      this.empValidationErrors['presentAddress'] = this.t('validation.addressRequired');

    const mobile = this.empForm.mobile.trim();
    if (!mobile)
      this.empValidationErrors['mobile'] = this.t('validation.phoneRequired');
    else if (!/^\d+$/.test(mobile))
      this.empValidationErrors['mobile'] = this.t('validation.phoneDigitsOnly');
    else if (mobile.length > 11)
      this.empValidationErrors['mobile'] = this.t('validation.phoneMaxLength');

    return Object.keys(this.empValidationErrors).length === 0;
  }

  saveEmployee(): void {
    if (!this.validateEmpForm()) return;
    this.isSaving = true;

    const payload = {
      firstName: this.empForm.firstName.trim(),
      lastName: this.empForm.lastName || undefined,
      gender: this.empForm.gender || undefined,
      mobile: this.empForm.mobile || undefined,
      email: this.empForm.email || undefined,
      presentAddress: this.empForm.presentAddress || undefined,
      joiningDate: this.empForm.joiningDate || undefined,
      departmentId: this.empForm.departmentId || undefined,
      designationId: this.empForm.designationId || undefined,
      salaryType: this.empForm.salaryType || 'Monthly',
      basicSalary: this.empForm.basicSalary || undefined,
      nidNo: this.empForm.nidNo || undefined,
      bankAccountNo: this.empForm.bankAccountNo || undefined,
      bankName: this.empForm.bankName || undefined,
    };

    const req$ = this.editingEmployeeId
      ? this.payrollService.updateEmployee(this.editingEmployeeId, payload)
      : this.payrollService.createEmployee(payload);

    req$.subscribe({
      next: (res: any) => {
        this.isSaving = false;
        this.alertService.success(res.message || this.t('messages.employeeSaved'));
        this.resetEmpForm();
        this.loadEmployees();
      },
      error: (err: any) => {
        this.isSaving = false;
        this.alertService.error(this.t('messages.employeeSaveError', { error: err.error?.message || err.message }));
      }
    });
  }

  editEmployee(e: Employee): void {
    this.editingEmployeeId = e.employeeId;
    this.empForm = {
      firstName: e.firstName, lastName: e.lastName || '', gender: e.gender || '',
      mobile: e.mobile || '', email: e.email || '', presentAddress: e.presentAddress || '',
      joiningDate: e.joiningDate ? e.joiningDate.split('T')[0] : toLocalDateString(),
      departmentId: e.departmentId || null, designationId: e.designationId || null,
      salaryType: e.salaryType || 'Monthly', basicSalary: e.basicSalary || null,
      nidNo: e.nidNo || '', bankAccountNo: e.bankAccountNo || '', bankName: e.bankName || ''
    };
    window.scrollTo({ top: 0, behavior: 'smooth' });
  }

  toggleEmployeeActive(e: Employee): void {
    this.payrollService.updateEmployee(e.employeeId, { firstName: e.firstName, isActive: !e.isActive }).subscribe({
      next: () => {
        this.alertService.success(this.t(!e.isActive ? 'messages.employeeActivated' : 'messages.employeeDeactivated'));
        this.loadEmployees();
      },
      error: (err: any) => this.alertService.error(this.t('messages.employeeStatusError', { error: err.error?.message || err.message }))
    });
  }

  resetEmpForm(): void {
    this.editingEmployeeId = null;
    this.empForm = {
      firstName: '', lastName: '', gender: '', mobile: '', email: '',
      presentAddress: '', joiningDate: toLocalDateString(),
      departmentId: null, designationId: null,
      salaryType: 'Monthly', basicSalary: null,
      nidNo: '', bankAccountNo: '', bankName: ''
    };
    this.empValidationErrors = {};
  }

  isEmpFieldInvalid(field: string): boolean { return !!this.empValidationErrors[field]; }

  // ══════════════════════════════════════════════════════════════════
  // Salary Structure
  // ══════════════════════════════════════════════════════════════════
  salaryEmployeeId: number | null = null;
  currentStructure: EmployeeSalary | null = null;
  salaryForm = {
    basicSalary: 0, houseRent: 0, medical: 0, transport: 0, food: 0, otherAllowance: 0,
    effectiveFrom: toLocalDateString()
  };
  isSalaryLoading = false;

  get salaryFormGross(): number {
    return (+this.salaryForm.basicSalary || 0) + (+this.salaryForm.houseRent || 0) +
      (+this.salaryForm.medical || 0) + (+this.salaryForm.transport || 0) +
      (+this.salaryForm.food || 0) + (+this.salaryForm.otherAllowance || 0);
  }

  onSalaryEmployeeChange(): void {
    if (this.salaryEmployeeId) this.loadSalaryStructure();
    else this.currentStructure = null;
  }

  loadSalaryStructure(): void {
    if (!this.salaryEmployeeId) return;
    this.isSalaryLoading = true;
    this.payrollService.getSalaryStructure(this.salaryEmployeeId).subscribe({
      next: (res) => {
        this.currentStructure = res.data || null;
        if (this.currentStructure) {
          this.salaryForm = {
            basicSalary: this.currentStructure.basicSalary, houseRent: this.currentStructure.houseRent,
            medical: this.currentStructure.medical, transport: this.currentStructure.transport,
            food: this.currentStructure.food, otherAllowance: this.currentStructure.otherAllowance,
            effectiveFrom: toLocalDateString()
          };
        }
        this.isSalaryLoading = false;
        this.cdr.detectChanges();
      },
      error: () => { this.isSalaryLoading = false; }
    });
  }

  saveSalaryStructure(): void {
    if (!this.salaryEmployeeId) {
      this.alertService.warning(this.t('messages.selectEmployeeFirst'));
      return;
    }
    if (!this.salaryForm.basicSalary || this.salaryForm.basicSalary <= 0) {
      this.alertService.warning(this.t('messages.basicSalaryPositive'));
      return;
    }
    this.isSaving = true;
    this.payrollService.setSalaryStructure({
      employeeId: this.salaryEmployeeId,
      basicSalary: +this.salaryForm.basicSalary,
      houseRent: +this.salaryForm.houseRent || 0,
      medical: +this.salaryForm.medical || 0,
      transport: +this.salaryForm.transport || 0,
      food: +this.salaryForm.food || 0,
      otherAllowance: +this.salaryForm.otherAllowance || 0,
      effectiveFrom: this.salaryForm.effectiveFrom
    }).subscribe({
      next: (res) => {
        this.isSaving = false;
        this.alertService.success(res.message || this.t('messages.salaryStructureSaved'));
        this.loadSalaryStructure();
      },
      error: (err: any) => {
        this.isSaving = false;
        this.alertService.error(this.t('messages.salaryStructureError', { error: err.error?.message || err.message }));
      }
    });
  }

  // ══════════════════════════════════════════════════════════════════
  // Attendance
  // ══════════════════════════════════════════════════════════════════
  attEmployeeId: number | null = null;
  attFromDate = toLocalDateString(new Date(new Date().getFullYear(), new Date().getMonth(), 1));
  attToDate = toLocalDateString();
  attendanceList: Attendance[] = [];
  isAttLoading = false;

  attForm = {
    attendanceDate: toLocalDateString(),
    status: 'Present',
    inTime: '', outTime: ''
  };

  onAttEmployeeChange(): void {
    if (this.attEmployeeId) this.loadAttendance();
    else this.attendanceList = [];
  }

  loadAttendance(): void {
    if (!this.attEmployeeId) return;
    this.isAttLoading = true;
    this.payrollService.getAttendance(this.attEmployeeId, this.attFromDate, this.attToDate).subscribe({
      next: (res) => { this.attendanceList = res.data || []; this.isAttLoading = false; this.cdr.detectChanges(); },
      error: () => { this.isAttLoading = false; }
    });
  }

  markAttendance(): void {
    if (!this.attEmployeeId) {
      this.alertService.warning(this.t('messages.selectEmployeeFirst'));
      return;
    }
    const date = this.attForm.attendanceDate;
    const toDateTime = (t: string) => t ? `${date}T${t}:00` : undefined;

    this.isSaving = true;
    this.payrollService.markAttendance({
      employeeId: this.attEmployeeId,
      attendanceDate: date,
      status: this.attForm.status,
      inTime: toDateTime(this.attForm.inTime),
      outTime: toDateTime(this.attForm.outTime)
    }).subscribe({
      next: (res) => {
        this.isSaving = false;
        this.alertService.success(res.message || this.t('messages.attendanceRecorded'));
        this.loadAttendance();
      },
      error: (err: any) => {
        this.isSaving = false;
        this.alertService.error(this.t('messages.attendanceError', { error: err.error?.message || err.message }));
      }
    });
  }

  statusBadgeClass(status: string): string {
    switch (status) {
      case 'Present': return 'bg-green-100 text-green-800';
      case 'Absent':  return 'bg-red-100 text-red-800';
      case 'Leave':   return 'bg-amber-100 text-amber-800';
      default:        return 'bg-gray-100 text-gray-800';
    }
  }

  // ══════════════════════════════════════════════════════════════════
  // Process Payroll
  // ══════════════════════════════════════════════════════════════════
  payForm = {
    employeeId: null as number | null,
    salaryMonth: new Date().getMonth() + 1,
    salaryYear: new Date().getFullYear(),
    overtimeAmount: 0, bonusAmount: 0, deduction: 0,
    paymentDate: toLocalDateString(),
    paymentMethod: DEFAULT_PAYMENT_METHOD, referenceNo: '', remarks: ''
  };
  lastResult: ProcessSalaryPaymentResult | null = null;
  salaryPayments: SalaryPayment[] = [];
  isPayrollLoading = false;

  years: number[] = Array.from({ length: 6 }, (_, i) => new Date().getFullYear() - 3 + i);

  // Due-advance warning: when an employee is selected for salary processing,
  // check whether they still owe on any advance so the amount isn't paid out
  // "blind" — the deduction still has to be entered manually, this just warns.
  payDueAdvanceTotal = 0;
  isCheckingDueAdvance = false;

  onPayEmployeeChange(): void {
    this.payDueAdvanceTotal = 0;
    if (!this.payForm.employeeId) return;

    this.isCheckingDueAdvance = true;
    this.payrollService.getAdvances(this.payForm.employeeId).subscribe({
      next: (res) => {
        this.payDueAdvanceTotal = (res.data || []).reduce((sum, a) => sum + (a.remainingAmount || 0), 0);
        this.isCheckingDueAdvance = false;
        this.cdr.detectChanges();
      },
      error: () => { this.isCheckingDueAdvance = false; }
    });
  }

  processSalaryPayment(): void {
    if (!this.payForm.employeeId) {
      this.alertService.warning(this.t('messages.selectEmployeeFirst'));
      return;
    }
    this.isSaving = true;
    this.lastResult = null;
    this.payrollService.processSalaryPayment({
      employeeId: this.payForm.employeeId,
      salaryMonth: +this.payForm.salaryMonth,
      salaryYear: +this.payForm.salaryYear,
      overtimeAmount: +this.payForm.overtimeAmount || 0,
      bonusAmount: +this.payForm.bonusAmount || 0,
      deduction: +this.payForm.deduction || 0,
      paymentDate: this.payForm.paymentDate || undefined,
      paymentMethod: this.payForm.paymentMethod || undefined,
      referenceNo: this.payForm.referenceNo || undefined,
      remarks: this.payForm.remarks || undefined
    }).subscribe({
      next: (res) => {
        this.isSaving = false;
        this.lastResult = res.data;
        this.alertService.success(res.message || this.t('messages.salaryProcessed'));
        this.resetPayForm();
        this.loadSalaryPayments();
      },
      error: (err: any) => {
        this.isSaving = false;
        this.alertService.error(this.t('messages.salaryProcessError', { error: err.error?.message || err.message }));
      }
    });
  }

  resetPayForm(): void {
    this.payForm = {
      employeeId: null,
      salaryMonth: new Date().getMonth() + 1,
      salaryYear: new Date().getFullYear(),
      overtimeAmount: 0, bonusAmount: 0, deduction: 0,
      paymentDate: toLocalDateString(),
      paymentMethod: DEFAULT_PAYMENT_METHOD, referenceNo: '', remarks: ''
    };
    this.payDueAdvanceTotal = 0;
  }

  loadSalaryPayments(): void {
    this.isPayrollLoading = true;
    this.payrollService.getSalaryPayments().subscribe({
      next: (res) => { this.salaryPayments = res.data || []; this.isPayrollLoading = false; this.cdr.detectChanges(); },
      error: () => { this.isPayrollLoading = false; }
    });
  }

  monthName(m: number): string { return this.months.find(x => x.id === m)?.name || String(m); }
  /** Translation key for a month id — the id itself is what's stored, this is display-only. */
  monthLabelKey(m: number): string { return `payroll.months.month${m}`; }

  // ══════════════════════════════════════════════════════════════════
  // Bonus
  // ══════════════════════════════════════════════════════════════════
  bonusForm = {
    employeeId: null as number | null, bonusDate: toLocalDateString(),
    bonusType: 'Festival Bonus', amount: null as number | null,
    remarks: '', paymentMethod: DEFAULT_PAYMENT_METHOD
  };
  bonusList: EmployeeBonus[] = [];
  isBonusLoading = false;

  loadBonuses(): void {
    this.isBonusLoading = true;
    this.payrollService.getBonuses().subscribe({
      next: (res) => { this.bonusList = res.data || []; this.isBonusLoading = false; this.cdr.detectChanges(); },
      error: () => { this.isBonusLoading = false; }
    });
  }

  addBonus(): void {
    if (!this.bonusForm.employeeId || !this.bonusForm.amount || this.bonusForm.amount <= 0) {
      this.alertService.warning(this.t('messages.selectEmployeeAndAmount'));
      return;
    }
    this.isSaving = true;
    this.payrollService.addBonus({
      employeeId: this.bonusForm.employeeId,
      bonusDate: this.bonusForm.bonusDate,
      bonusType: this.bonusForm.bonusType,
      amount: +this.bonusForm.amount,
      remarks: this.bonusForm.remarks || undefined,
      paymentMethod: this.bonusForm.paymentMethod || undefined
    }).subscribe({
      next: (res) => {
        this.isSaving = false;
        this.alertService.success(res.message || this.t('messages.bonusRecorded'));
        this.bonusForm = { employeeId: null, bonusDate: toLocalDateString(), bonusType: 'Festival Bonus', amount: null, remarks: '', paymentMethod: DEFAULT_PAYMENT_METHOD };
        this.loadBonuses();
      },
      error: (err: any) => {
        this.isSaving = false;
        this.alertService.error(this.t('messages.bonusError', { error: err.error?.message || err.message }));
      }
    });
  }

  // ══════════════════════════════════════════════════════════════════
  // Advance
  // ══════════════════════════════════════════════════════════════════
  advanceForm = {
    employeeId: null as number | null, advanceDate: toLocalDateString(),
    amount: null as number | null, remarks: '', paymentMethod: DEFAULT_PAYMENT_METHOD
  };
  advanceList: EmployeeAdvance[] = [];
  isAdvanceLoading = false;
  repayAmounts: Record<number, number> = {};

  loadAdvances(): void {
    this.isAdvanceLoading = true;
    this.payrollService.getAdvances().subscribe({
      next: (res) => { this.advanceList = res.data || []; this.isAdvanceLoading = false; this.cdr.detectChanges(); },
      error: () => { this.isAdvanceLoading = false; }
    });
  }

  addAdvance(): void {
    if (!this.advanceForm.employeeId || !this.advanceForm.amount || this.advanceForm.amount <= 0) {
      this.alertService.warning(this.t('messages.selectEmployeeAndAmount'));
      return;
    }
    this.isSaving = true;
    this.payrollService.addAdvance({
      employeeId: this.advanceForm.employeeId,
      advanceDate: this.advanceForm.advanceDate,
      amount: +this.advanceForm.amount,
      remarks: this.advanceForm.remarks || undefined,
      paymentMethod: this.advanceForm.paymentMethod || undefined
    }).subscribe({
      next: (res) => {
        this.isSaving = false;
        this.alertService.success(res.message || this.t('messages.advanceRecorded'));
        this.advanceForm = { employeeId: null, advanceDate: toLocalDateString(), amount: null, remarks: '', paymentMethod: DEFAULT_PAYMENT_METHOD };
        this.loadAdvances();
      },
      error: (err: any) => {
        this.isSaving = false;
        this.alertService.error(this.t('messages.advanceError', { error: err.error?.message || err.message }));
      }
    });
  }

  repayAdvance(advanceId: number): void {
    const amount = this.repayAmounts[advanceId];
    if (!amount || amount <= 0) {
      this.alertService.warning(this.t('messages.repaymentValidAmount'));
      return;
    }
    this.payrollService.repayAdvance({ advanceId, amount: +amount, paymentMethod: DEFAULT_PAYMENT_METHOD }).subscribe({
      next: (res) => {
        const applied = res.data?.appliedAmount ?? amount;
        const txnNo = res.data?.txnNo ? ` (GL ${res.data.txnNo})` : '';
        this.alertService.success(this.t('messages.repaymentRecorded', { amount: '৳' + applied.toFixed(2), txnNo }));
        this.repayAmounts[advanceId] = 0;
        this.loadAdvances();
      },
      error: (err: any) => this.alertService.error(this.t('messages.repaymentError', { error: err.error?.message || err.message }))
    });
  }
}
