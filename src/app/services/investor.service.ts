import { HttpClient } from '@angular/common/http';
import { Injectable } from '@angular/core';
import { Observable } from 'rxjs';
import { environment } from '../../environments/environment';

export interface Investor {
  investorId: number;
  tenantId: number;
  investorName: string;
  phone?: string;
  currentBalance: number; // running total invested to date
  isActive: boolean;
  createdAt: string;
}

export interface CreateInvestorRequest {
  investorName: string;
  phone?: string;
}

@Injectable({ providedIn: 'root' })
export class InvestorService {
  private baseUrl = environment.baseUrl;

  constructor(private http: HttpClient) {}

  getAllInvestors(isActive?: boolean): Observable<{ success: boolean; data: Investor[] }> {
    const params = isActive !== undefined ? `?isActive=${isActive}` : '';
    return this.http.get<any>(`${this.baseUrl}/investors${params}`);
  }

  createInvestor(payload: CreateInvestorRequest): Observable<{ success: boolean; message: string; data: Investor }> {
    return this.http.post<any>(`${this.baseUrl}/investors`, payload);
  }
}
