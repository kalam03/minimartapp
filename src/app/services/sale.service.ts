import { HttpClient } from '@angular/common/http';
import { Injectable } from '@angular/core';
import { Observable } from 'rxjs';
import { environment } from '../../environments/environment';

export interface DailyPerformanceDto {
  date: string;
  totalSales: number;
  totalPurchases: number;
  profit: number;
}

export interface SalesSummaryDto {
  totalInvoices: number;
  totalSales: number;
  totalDiscount: number;
  totalTransport: number;
  totalNetAmount: number;
  totalPaid: number;
  totalDue: number;
}

@Injectable({ providedIn: 'root' })
export class SaleService {

  private baseUrl = environment.baseUrl;

  constructor(private http: HttpClient) {}

  createSale(payload: any) {
    return this.http.post(this.baseUrl + '/sales', payload);
  }

  getSalesSummary(fromDate: string, toDate: string): Observable<{ success: boolean; data: SalesSummaryDto }> {
    return this.http.get<{ success: boolean; data: SalesSummaryDto }>(
      `${this.baseUrl}/sales/summary?fromDate=${fromDate}&toDate=${toDate}`
    );
  }

  getDailyPerformance(days: number = 7): Observable<{ success: boolean; data: DailyPerformanceDto[] }> {
    return this.http.get<{ success: boolean; data: DailyPerformanceDto[] }>(
      `${this.baseUrl}/dashboard/daily-performance?days=${days}`
    );
  }

  getCustomerDue(search: string, pageNo: number, pageSize: number): Observable<{ success: boolean; totalCount: number; data: any[] }> {
    return this.http.get<any>(`${this.baseUrl}/dashboard/customer-due?search=${encodeURIComponent(search)}&pageNo=${pageNo}&pageSize=${pageSize}`);
  }

  getSupplierDue(search: string, pageNo: number, pageSize: number): Observable<{ success: boolean; totalCount: number; data: any[] }> {
    return this.http.get<any>(`${this.baseUrl}/dashboard/supplier-due?search=${encodeURIComponent(search)}&pageNo=${pageNo}&pageSize=${pageSize}`);
  }

  getLowStock(search: string, threshold: number, pageNo: number, pageSize: number): Observable<{ success: boolean; totalCount: number; data: any[] }> {
    return this.http.get<any>(`${this.baseUrl}/dashboard/low-stock?search=${encodeURIComponent(search)}&threshold=${threshold}&pageNo=${pageNo}&pageSize=${pageSize}`);
  }

  getRecentTransactions(
    search: string,
    drCr: string,
    pageNo: number,
    pageSize: number
  ): Observable<{ success: boolean; totalCount: number; totalDebit: number; totalCredit: number; data: any[] }> {
    return this.http.get<any>(
      `${this.baseUrl}/dashboard/recent-transactions?search=${encodeURIComponent(search)}&drCr=${encodeURIComponent(drCr)}&pageNo=${pageNo}&pageSize=${pageSize}`
    );
  }
}
