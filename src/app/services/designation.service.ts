import { HttpClient } from '@angular/common/http';
import { Injectable } from '@angular/core';
import { Observable } from 'rxjs';
import { environment } from '../../environments/environment';

export interface Designation {
  designationId: number;
  tenantId: number;
  designationName: string;
  isActive: boolean;
  createdAt: string;
}

export interface CreateDesignationRequest {
  designationName: string;
}

@Injectable({ providedIn: 'root' })
export class DesignationService {
  private baseUrl = environment.baseUrl;

  constructor(private http: HttpClient) {}

  getAll(): Observable<{ success: boolean; data: Designation[] }> {
    return this.http.get<any>(`${this.baseUrl}/payroll/designations`);
  }

  create(payload: CreateDesignationRequest): Observable<{ success: boolean; message: string; data: { designationId: number } }> {
    return this.http.post<any>(`${this.baseUrl}/payroll/designations`, payload);
  }
}
