import { HttpClient } from '@angular/common/http';
import { Injectable } from '@angular/core';
import { Observable } from 'rxjs';
import { environment } from '../../environments/environment';

export interface Employee {
  employeeId: number;
  tenantId: number;
  employeeName: string;
  phone?: string;
  designation?: string;
  monthlySalary?: number;
  currentBalance: number; // running total paid to date
  isActive: boolean;
  createdAt: string;
}

export interface CreateEmployeeRequest {
  employeeName: string;
  phone?: string;
  designation?: string;
  monthlySalary?: number;
}

@Injectable({ providedIn: 'root' })
export class EmployeeService {
  private baseUrl = environment.baseUrl;

  constructor(private http: HttpClient) {}

  getAllEmployees(isActive?: boolean): Observable<{ success: boolean; data: Employee[] }> {
    const params = isActive !== undefined ? `?isActive=${isActive}` : '';
    return this.http.get<any>(`${this.baseUrl}/employees${params}`);
  }

  createEmployee(payload: CreateEmployeeRequest): Observable<{ success: boolean; message: string; data: Employee }> {
    return this.http.post<any>(`${this.baseUrl}/employees`, payload);
  }
}
