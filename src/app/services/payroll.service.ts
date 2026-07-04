import { HttpClient } from '@angular/common/http';
import { Injectable } from '@angular/core';
import { Observable } from 'rxjs';
import { environment } from '../../environments/environment';

export interface Employee {
  employeeId: number;
  employeeCode: string;
  firstName: string;
  lastName?: string;
  fullName: string;
  gender?: string;
  dateOfBirth?: string;
  mobile?: string;
  email?: string;
  presentAddress?: string;
  permanentAddress?: string;
  joiningDate?: string;
  confirmationDate?: string;
  resignDate?: string;
  departmentId?: number;
  departmentName?: string;
  designationId?: number;
  designationName?: string;
  branchId?: number;
  salaryType?: string;
  basicSalary?: number;
  nidNo?: string;
  bankAccountNo?: string;
  bankName?: string;
  photo?: string;
  isActive: boolean;
  tenantId: number;
  createdDate: string;
}

export interface CreateEmployeeRequest {
  firstName: string;
  lastName?: string;
  gender?: string;
  dateOfBirth?: string;
  mobile?: string;
  email?: string;
  presentAddress?: string;
  permanentAddress?: string;
  joiningDate?: string;
  departmentId?: number;
  designationId?: number;
  branchId?: number;
  salaryType?: string;
  basicSalary?: number;
  nidNo?: string;
  bankAccountNo?: string;
  bankName?: string;
  photo?: string;
}

export interface UpdateEmployeeRequest extends CreateEmployeeRequest {
  isActive?: boolean;
  resignDate?: string;
}

export interface EmployeeSalary {
  salaryId: number;
  employeeId: number;
  basicSalary: number;
  houseRent: number;
  medical: number;
  transport: number;
  food: number;
  otherAllowance: number;
  grossSalary: number;
  effectiveFrom: string;
  isActive: boolean;
}

export interface SetSalaryStructureRequest {
  employeeId: number;
  basicSalary: number;
  houseRent: number;
  medical: number;
  transport: number;
  food: number;
  otherAllowance: number;
  effectiveFrom: string;
}

export interface Attendance {
  attendanceId: number;
  employeeId: number;
  attendanceDate: string;
  inTime?: string;
  outTime?: string;
  workingHour?: number;
  status: string;
}

export interface MarkAttendanceRequest {
  employeeId: number;
  attendanceDate: string;
  status: string; // Present | Absent | Leave
  inTime?: string;
  outTime?: string;
}

export interface ProcessSalaryPaymentRequest {
  employeeId: number;
  salaryMonth: number;
  salaryYear: number;
  overtimeAmount: number;
  bonusAmount: number;
  deduction: number;
  paymentDate?: string;
  paymentMethod?: string;
  referenceNo?: string;
  remarks?: string;
}

export interface ProcessSalaryPaymentResult {
  salaryPaymentId: number;
  glTransactionId: number;
  txnNo: string;
  grossSalary: number;
  netSalary: number;
  workingDays: number;
  presentDays: number;
  leaveDays: number;
  absentDays: number;
}

export interface SalaryPayment {
  salaryPaymentId: number;
  employeeId: number;
  fullName: string;
  employeeCode: string;
  salaryMonth: number;
  salaryYear: number;
  workingDays?: number;
  presentDays?: number;
  leaveDays?: number;
  absentDays?: number;
  grossSalary: number;
  overtimeAmount: number;
  bonusAmount: number;
  deduction: number;
  netSalary: number;
  paymentDate?: string;
  paymentMethod?: string;
  remarks?: string;
  referenceNo?: string;
}

export interface AddBonusRequest {
  employeeId: number;
  bonusDate: string;
  bonusType: string;
  amount: number;
  remarks?: string;
  paymentMethod?: string;
  referenceNo?: string;
}

export interface EmployeeBonus {
  bonusId: number;
  employeeId: number;
  fullName: string;
  bonusDate: string;
  bonusType?: string;
  amount: number;
  remarks?: string;
  paymentMethod?: string;
}

export interface AddAdvanceRequest {
  employeeId: number;
  advanceDate: string;
  amount: number;
  remarks?: string;
  paymentMethod?: string;
  referenceNo?: string;
}

export interface EmployeeAdvance {
  advanceId: number;
  employeeId: number;
  fullName: string;
  advanceDate: string;
  amount: number;
  remainingAmount: number;
  remarks?: string;
  paymentMethod?: string;
}

export interface RepayAdvanceRequest {
  advanceId: number;
  amount: number;
  repaymentDate?: string;
  paymentMethod?: string;
  referenceNo?: string;
}

export interface RepayAdvanceResult {
  repaymentId: number;
  glTransactionId: number;
  txnNo: string;
  appliedAmount: number;
  remainingAmount: number;
}

export interface AdvanceRepayment {
  repaymentId: number;
  advanceId: number;
  employeeId: number;
  fullName: string;
  repaymentDate: string;
  amount: number;
  paymentMethod?: string;
  referenceNo?: string;
  glTransactionId?: number;
}

@Injectable({ providedIn: 'root' })
export class PayrollService {
  private baseUrl = `${environment.baseUrl}/payroll`;

  constructor(private http: HttpClient) {}

  // Employees
  getEmployees(isActive?: boolean): Observable<{ success: boolean; data: Employee[] }> {
    const params = isActive !== undefined ? `?isActive=${isActive}` : '';
    return this.http.get<any>(`${this.baseUrl}/employees${params}`);
  }

  createEmployee(payload: CreateEmployeeRequest): Observable<{ success: boolean; message: string; data: { employeeId: number } }> {
    return this.http.post<any>(`${this.baseUrl}/employees`, payload);
  }

  updateEmployee(employeeId: number, payload: UpdateEmployeeRequest): Observable<{ success: boolean; message: string }> {
    return this.http.put<any>(`${this.baseUrl}/employees/${employeeId}`, payload);
  }

  // Salary structure
  setSalaryStructure(payload: SetSalaryStructureRequest): Observable<{ success: boolean; message: string }> {
    return this.http.post<any>(`${this.baseUrl}/salary-structure`, payload);
  }

  getSalaryStructure(employeeId: number): Observable<{ success: boolean; data: EmployeeSalary | null }> {
    return this.http.get<any>(`${this.baseUrl}/salary-structure/${employeeId}`);
  }

  // Attendance
  markAttendance(payload: MarkAttendanceRequest): Observable<{ success: boolean; message: string }> {
    return this.http.post<any>(`${this.baseUrl}/attendance`, payload);
  }

  getAttendance(employeeId: number, fromDate: string, toDate: string): Observable<{ success: boolean; data: Attendance[] }> {
    return this.http.get<any>(`${this.baseUrl}/attendance?employeeId=${employeeId}&fromDate=${fromDate}&toDate=${toDate}`);
  }

  // Salary payment (payroll run)
  processSalaryPayment(payload: ProcessSalaryPaymentRequest): Observable<{ success: boolean; message: string; data: ProcessSalaryPaymentResult }> {
    return this.http.post<any>(`${this.baseUrl}/salary-payments/process`, payload);
  }

  getSalaryPayments(employeeId?: number, salaryMonth?: number, salaryYear?: number): Observable<{ success: boolean; data: SalaryPayment[] }> {
    const params: string[] = [];
    if (employeeId) params.push(`employeeId=${employeeId}`);
    if (salaryMonth) params.push(`salaryMonth=${salaryMonth}`);
    if (salaryYear) params.push(`salaryYear=${salaryYear}`);
    const qs = params.length ? `?${params.join('&')}` : '';
    return this.http.get<any>(`${this.baseUrl}/salary-payments${qs}`);
  }

  // Bonus
  addBonus(payload: AddBonusRequest): Observable<{ success: boolean; message: string; data: { glTransactionId: number; txnNo: string } }> {
    return this.http.post<any>(`${this.baseUrl}/bonus`, payload);
  }

  getBonuses(employeeId?: number): Observable<{ success: boolean; data: EmployeeBonus[] }> {
    const params = employeeId ? `?employeeId=${employeeId}` : '';
    return this.http.get<any>(`${this.baseUrl}/bonus${params}`);
  }

  // Advance
  addAdvance(payload: AddAdvanceRequest): Observable<{ success: boolean; message: string; data: { glTransactionId: number; txnNo: string } }> {
    return this.http.post<any>(`${this.baseUrl}/advance`, payload);
  }

  getAdvances(employeeId?: number): Observable<{ success: boolean; data: EmployeeAdvance[] }> {
    const params = employeeId ? `?employeeId=${employeeId}` : '';
    return this.http.get<any>(`${this.baseUrl}/advance${params}`);
  }

  repayAdvance(payload: RepayAdvanceRequest): Observable<{ success: boolean; message: string; data: RepayAdvanceResult }> {
    return this.http.post<any>(`${this.baseUrl}/advance/repay`, payload);
  }

  getAdvanceRepayments(advanceId?: number): Observable<{ success: boolean; data: AdvanceRepayment[] }> {
    const params = advanceId ? `?advanceId=${advanceId}` : '';
    return this.http.get<any>(`${this.baseUrl}/advance/repayments${params}`);
  }
}
