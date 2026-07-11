import { Component, OnInit, ChangeDetectorRef } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { DepartmentService, Department } from '../../services/department.service';
import { DesignationService, Designation } from '../../services/designation.service';
import {
  PayrollService, Employee, EmployeeSalary, Attendance,
  SalaryPayment, EmployeeBonus, EmployeeAdvance, ProcessSalaryPaymentResult
} from '../../services/payroll.service';
import { AlertService } from '../../shared/alert.service';
import { toLocalDateString } from '../../shared/date-utils';

type Tab = 'employees' | 'salary' | 'attendance' | 'payroll' | 'bonus' | 'advance';

@Component({
  selector: 'app-payroll',
  standalone: true,
  imports: [CommonModule, FormsModule],
  templateUrl: './payroll.component.html',
  styleUrls: ['./payroll.component.css']
})
export class PayrollComponent implements OnInit {

  activeTab: Tab = 'employees';
  tabs: { id: Tab; label: string }[] = [
    { id: 'employees',  label: 'Employees' },
    { id: 'salary',     label: 'Salary Structure' },
    { id: 'attendance', label: 'Attendance' },
    { id: 'payroll',    label: 'Process Payroll' },
    { id: 'bonus',      label: 'Bonus' },
    { id: 'advance',    label: 'Advance' },
  ];

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

  get activeEmployees(): Employee[] { return this.employees.filter(e => e.isActive); }

  constructor(
    private payrollService: PayrollService,
    private departmentService: DepartmentService,
    private designationService: DesignationService,
    private alertService: AlertService,
    private cdr: ChangeDetectorRef
  ) {}

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
        this.alertService.success(res.message || 'Department added');
        this.newDepartmentName = '';
        this.loadDepartments();
      },
      error: (err: any) => this.alertService.error('Failed to add department: ' + (err.error?.message || err.message))
    });
  }

  addDesignation(): void {
    if (!this.newDesignationName.trim()) return;
    this.designationService.create({ designationName: this.newDesignationName.trim() }).subscribe({
      next: (res) => {
        this.alertService.success(res.message || 'Designation added');
        this.newDesignationName = '';
        this.loadDesignations();
      },
      error: (err: any) => this.alertService.error('Failed to add designation: ' + (err.error?.message || err.message))
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
      error: (err: any) => this.alertService.error('Failed to load employees: ' + (err.error?.message || err.message))
    });
  }

  validateEmpForm(): boolean {
    this.empValidationErrors = {};
    if (!this.empForm.firstName.trim())
      this.empValidationErrors['firstName'] = 'First name is required';
    if (!this.empForm.nidNo.trim())
      this.empValidationErrors['nidNo'] = 'NID number is required';
    if (!this.empForm.departmentId)
      this.empValidationErrors['departmentId'] = 'Department is required';
    if (!this.empForm.designationId)
      this.empValidationErrors['designationId'] = 'Designation is required';
    if (!this.empForm.gender)
      this.empValidationErrors['gender'] = 'Gender is required';
    if (!this.empForm.presentAddress.trim())
      this.empValidationErrors['presentAddress'] = 'Present address is required';

    const mobile = this.empForm.mobile.trim();
    if (!mobile)
      this.empValidationErrors['mobile'] = 'Phone number is required';
    else if (!/^\d+$/.test(mobile))
      this.empValidationErrors['mobile'] = 'Phone number must contain digits only';
    else if (mobile.length > 11)
      this.empValidationErrors['mobile'] = 'Phone number cannot exceed 11 characters';

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
        this.alertService.success(res.message || 'Employee saved successfully!');
        this.resetEmpForm();
        this.loadEmployees();
      },
      error: (err: any) => {
        this.isSaving = false;
        this.alertService.error('Failed to save employee: ' + (err.error?.message || err.message));
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
      next: () => { this.alertService.success(`Employee ${!e.isActive ? 'activated' : 'deactivated'}`); this.loadEmployees(); },
      error: (err: any) => this.alertService.error('Failed to update: ' + (err.error?.message || err.message))
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
      this.alertService.warning('Select an employee first');
      return;
    }
    if (!this.salaryForm.basicSalary || this.salaryForm.basicSalary <= 0) {
      this.alertService.warning('Basic salary must be greater than 0');
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
        this.alertService.success(res.message || 'Salary structure saved');
        this.loadSalaryStructure();
      },
      error: (err: any) => {
        this.isSaving = false;
        this.alertService.error('Failed to save salary structure: ' + (err.error?.message || err.message));
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
      this.alertService.warning('Select an employee first');
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
        this.alertService.success(res.message || 'Attendance recorded');
        this.loadAttendance();
      },
      error: (err: any) => {
        this.isSaving = false;
        this.alertService.error('Failed to mark attendance: ' + (err.error?.message || err.message));
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
    paymentMethod: 'Cash', referenceNo: '', remarks: ''
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
      this.alertService.warning('Select an employee first');
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
        this.alertService.success(res.message || 'Salary processed successfully!');
        this.resetPayForm();
        this.loadSalaryPayments();
      },
      error: (err: any) => {
        this.isSaving = false;
        this.alertService.error('Failed to process salary: ' + (err.error?.message || err.message));
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
      paymentMethod: 'Cash', referenceNo: '', remarks: ''
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

  // ══════════════════════════════════════════════════════════════════
  // Bonus
  // ══════════════════════════════════════════════════════════════════
  bonusForm = {
    employeeId: null as number | null, bonusDate: toLocalDateString(),
    bonusType: 'Festival Bonus', amount: null as number | null,
    remarks: '', paymentMethod: 'Cash'
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
      this.alertService.warning('Select an employee and enter a valid amount');
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
        this.alertService.success(res.message || 'Bonus recorded successfully!');
        this.bonusForm = { employeeId: null, bonusDate: toLocalDateString(), bonusType: 'Festival Bonus', amount: null, remarks: '', paymentMethod: 'Cash' };
        this.loadBonuses();
      },
      error: (err: any) => {
        this.isSaving = false;
        this.alertService.error('Failed to record bonus: ' + (err.error?.message || err.message));
      }
    });
  }

  // ══════════════════════════════════════════════════════════════════
  // Advance
  // ══════════════════════════════════════════════════════════════════
  advanceForm = {
    employeeId: null as number | null, advanceDate: toLocalDateString(),
    amount: null as number | null, remarks: '', paymentMethod: 'Cash'
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
      this.alertService.warning('Select an employee and enter a valid amount');
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
        this.alertService.success(res.message || 'Advance recorded successfully!');
        this.advanceForm = { employeeId: null, advanceDate: toLocalDateString(), amount: null, remarks: '', paymentMethod: 'Cash' };
        this.loadAdvances();
      },
      error: (err: any) => {
        this.isSaving = false;
        this.alertService.error('Failed to record advance: ' + (err.error?.message || err.message));
      }
    });
  }

  repayAdvance(advanceId: number): void {
    const amount = this.repayAmounts[advanceId];
    if (!amount || amount <= 0) {
      this.alertService.warning('Enter a valid repayment amount');
      return;
    }
    this.payrollService.repayAdvance({ advanceId, amount: +amount, paymentMethod: 'Cash' }).subscribe({
      next: (res) => {
        const applied = res.data?.appliedAmount ?? amount;
        const txnNo = res.data?.txnNo ? ` (GL ${res.data.txnNo})` : '';
        this.alertService.success(`Repayment of ৳${applied.toFixed(2)} recorded and posted to the Cash Vault ledger${txnNo}.`);
        this.repayAmounts[advanceId] = 0;
        this.loadAdvances();
      },
      error: (err: any) => this.alertService.error('Failed to record repayment: ' + (err.error?.message || err.message))
    });
  }
}
