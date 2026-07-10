import { HttpClient } from '@angular/common/http';
import { Injectable } from '@angular/core';
import { Observable } from 'rxjs';
import { environment } from '../../environments/environment';

export interface UnitType {
  unitTypeId: number;
  tenantId: number;
  unitCode: string;
  unitName: string;
  isWeight: boolean;
  isActive: boolean;
  createdAt: string;
}

export interface CreateUnitTypeRequest {
  unitCode: string;
  unitName: string;
  isWeight: boolean;
}

export interface UpdateUnitTypeRequest extends CreateUnitTypeRequest {
  isActive: boolean;
}

@Injectable({ providedIn: 'root' })
export class UnitTypeService {
  private baseUrl = environment.baseUrl;

  constructor(private http: HttpClient) {}

  getAllUnitTypes(isActive?: boolean): Observable<{ success: boolean; data: UnitType[] }> {
    const params = isActive !== undefined ? `?isActive=${isActive}` : '';
    return this.http.get<any>(`${this.baseUrl}/unittypes${params}`);
  }

  createUnitType(payload: CreateUnitTypeRequest): Observable<{ success: boolean; message: string; data: UnitType }> {
    return this.http.post<any>(`${this.baseUrl}/unittypes`, payload);
  }

  updateUnitType(id: number, payload: UpdateUnitTypeRequest): Observable<{ success: boolean; message: string }> {
    return this.http.put<any>(`${this.baseUrl}/unittypes/${id}`, payload);
  }

  deleteUnitType(id: number): Observable<{ success: boolean; message: string }> {
    return this.http.delete<any>(`${this.baseUrl}/unittypes/${id}`);
  }
}
