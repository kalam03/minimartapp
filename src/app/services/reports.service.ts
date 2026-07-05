import { HttpClient } from '@angular/common/http';
import { Injectable } from '@angular/core';
import { Observable } from 'rxjs';
import { environment } from '../../environments/environment';

export interface DailyProfitDto {
  saleDate: string;
  totalQty: number;
  totalSales: number;
  totalCost: number;
  totalProfit: number;
  profitMarginPct: number;
}

export interface ProductProfitDto {
  saleDate: string;
  productId: number;
  productName: string;
  qty: number;
  sellPrice: number;
  costPrice: number;
  totalSales: number;
  totalCost: number;
  profit: number;
}

export interface TopSellingProductDto {
  productId: number;
  productName: string;
  totalQty: number;
  daysSold: number;
  avgQtyPerDaySold: number;
  totalSales: number;
  totalCost: number;
  totalProfit: number;
  qtyRank: number;
  demandLevel: 'High' | 'Medium' | 'Low' | string;
}

export interface ProfitByDateResponse {
  success: boolean;
  fromDate: string;
  toDate: string;
  totalSales: number;
  totalCost: number;
  totalProfit: number;
  bestSeller: TopSellingProductDto | null;
  dailySummary: DailyProfitDto[];
  productDaily: ProductProfitDto[];
  topProducts: TopSellingProductDto[];
}

@Injectable({ providedIn: 'root' })
export class ReportsService {
  private baseUrl = environment.baseUrl;

  constructor(private http: HttpClient) {}

  getProfitByDate(fromDate: string, toDate: string): Observable<ProfitByDateResponse> {
    const params = new URLSearchParams();
    if (fromDate) params.set('fromDate', fromDate);
    if (toDate)   params.set('toDate', toDate);
    const query = params.toString();
    return this.http.get<ProfitByDateResponse>(
      `${this.baseUrl}/reports/profit-by-date${query ? '?' + query : ''}`
    );
  }
}
