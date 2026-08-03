import { HttpClient } from '@angular/common/http';
import { Injectable } from '@angular/core';
import { Observable } from 'rxjs';
import { environment } from '../../environments/environment';

export interface CashbackConfig {
  cashbackConfigId: number;
  configName: string;
  cashbackType: 'Percentage' | 'Fixed';
  cashbackValue: number;
  minPurchaseAmount: number;
  maxCashbackAmount: number | null;
  startDate: string;
  endDate: string;
  priority: number;
  isActive: boolean;
  createdAt: string;
}

export interface SaveCashbackConfigRequest {
  configName: string;
  cashbackType: 'Percentage' | 'Fixed';
  cashbackValue: number;
  minPurchaseAmount: number;
  maxCashbackAmount: number | null;
  startDate: string;
  endDate: string;
  priority: number;
  isActive: boolean;
}

export interface CashbackTransaction {
  cashbackTransactionId: number;
  saleId: number | null;
  transactionType: 'Earned' | 'Redeemed' | 'Expired' | 'Adjusted';
  amount: number;
  balanceAfter: number;
  remarks: string | null;
  createdAt: string;
}

export interface CustomerCashbackSummary {
  customerId: number;
  cashbackBalance: number;
  history: CashbackTransaction[];
}

@Injectable({ providedIn: 'root' })
export class CashbackService {
  private baseUrl = environment.baseUrl;

  constructor(private http: HttpClient) {}

  getAllConfigs(): Observable<{ success: boolean; data: CashbackConfig[] }> {
    return this.http.get<any>(`${this.baseUrl}/cashback/configs`);
  }

  createConfig(payload: SaveCashbackConfigRequest): Observable<{ success: boolean; message: string; data: { cashbackConfigId: number } }> {
    return this.http.post<any>(`${this.baseUrl}/cashback/configs`, payload);
  }

  updateConfig(id: number, payload: SaveCashbackConfigRequest): Observable<{ success: boolean; message: string }> {
    return this.http.put<any>(`${this.baseUrl}/cashback/configs/${id}`, payload);
  }

  deleteConfig(id: number): Observable<{ success: boolean; message: string }> {
    return this.http.delete<any>(`${this.baseUrl}/cashback/configs/${id}`);
  }

  getCustomerSummary(customerId: number): Observable<{ success: boolean; data: CustomerCashbackSummary }> {
    return this.http.get<any>(`${this.baseUrl}/cashback/customers/${customerId}/summary`);
  }
}
