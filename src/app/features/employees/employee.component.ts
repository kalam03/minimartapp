import { Component, OnInit, ChangeDetectorRef } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { EmployeeService, Employee } from '../../services/employee.service';
import { AlertService } from '../../shared/alert.service';

@Component({
  selector: 'app-employee',
  standalone: true,
  imports: [CommonModule, FormsModule],
  templateUrl: './employee.component.html',
  styleUrls: ['./employee.component.css']
})
export class EmployeeComponent implements OnInit {
  employees: Employee[] = [];
  isSaving = false;
  searchText = '';

  form = {
    employeeName: '',
    phone: '',
    designation: '',
    monthlySalary: null as number | null
  };
  validationErrors: Record<string, string> = {};

  get filteredEmployees(): Employee[] {
    const q = this.searchText.trim().toLowerCase();
    if (!q) return this.employees;
    return this.employees.filter(e =>
      e.employeeName.toLowerCase().includes(q) ||
      (e.designation || '').toLowerCase().includes(q) ||
      (e.phone || '').includes(q)
    );
  }

  constructor(
    private employeeService: EmployeeService,
    private alertService: AlertService,
    private cdr: ChangeDetectorRef
  ) {}

  ngOnInit(): void {
    this.loadEmployees();
  }

  loadEmployees(): void {
    this.employeeService.getAllEmployees().subscribe({
      next: (res) => {
        this.employees = res.data || [];
        this.cdr.detectChanges();
      },
      error: (err: any) => {
        this.alertService.error('Failed to load employees: ' + (err.error?.message || err.message));
      }
    });
  }

  validateForm(): boolean {
    this.validationErrors = {};
    if (!this.form.employeeName.trim())
      this.validationErrors['employeeName'] = 'Employee name is required';
    return Object.keys(this.validationErrors).length === 0;
  }

  isFieldInvalid(field: string): boolean {
    return !!this.validationErrors[field];
  }

  saveEmployee(): void {
    if (!this.validateForm()) return;

    this.isSaving = true;
    this.employeeService.createEmployee({
      employeeName: this.form.employeeName.trim(),
      phone: this.form.phone || undefined,
      designation: this.form.designation || undefined,
      monthlySalary: this.form.monthlySalary || undefined
    }).subscribe({
      next: (res) => {
        this.isSaving = false;
        this.alertService.success(res.message || 'Employee added successfully!');
        this.resetForm();
        this.loadEmployees();
      },
      error: (err: any) => {
        this.isSaving = false;
        this.alertService.error('Failed to add employee: ' + (err.error?.message || err.message));
      }
    });
  }

  resetForm(): void {
    this.form = { employeeName: '', phone: '', designation: '', monthlySalary: null };
    this.validationErrors = {};
  }
}
