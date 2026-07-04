import { HttpClient } from '@angular/common/http';
import { Injectable } from '@angular/core';
import { Observable } from 'rxjs';
import { environment } from '../../environments/environment';

export interface Department {
  departmentId: number;
  tenantId: number;
  departmentName: string;
  isActive: boolean;
  createdAt: string;
}

export interface CreateDepartmentRequest {
  departmentName: string;
}

@Injectable({ providedIn: 'root' })
export class DepartmentService {
  private baseUrl = environment.baseUrl;

  constructor(private http: HttpClient) {}

  getAll(): Observable<{ success: boolean; data: Department[] }> {
    return this.http.get<any>(`${this.baseUrl}/payroll/departments`);
  }

  create(payload: CreateDepartmentRequest): Observable<{ success: boolean; message: string; data: { departmentId: number } }> {
    return this.http.post<any>(`${this.baseUrl}/payroll/departments`, payload);
  }
}
