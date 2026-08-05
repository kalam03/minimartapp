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

export interface StockConflictError {
  success:     boolean;
  errorCode:   'STOCK_INSUFFICIENT';
  productId:   number;
  productName: string;
  available:   number;
  required:    number;
  message:     string;
}

export interface PromotionQuoteItem {
  productId: number;
  quantity: number;
  unitPrice: number;
}

export interface PromotionQuoteRequest {
  customerId: number;
  items: PromotionQuoteItem[];
  manualDiscount: number;
  transportCost: number;
  redeemPoints?: number | null;
  redeemCashback?: number | null;
}

// One free line inside a "Buy X, get Y free" combo
export interface FreeItemLine {
  productId: number;
  qty: number;
  value: number;
}

export interface AppliedPromotion {
  promotionType: string;
  referenceId: number;
  description: string;
  discountAmount: number;
  saleDetailProductId: number | null;
  // Populated only for a free-item combo
  freeItems: FreeItemLine[] | null;
}

// Mirrors PromotionEngineResult — response of POST /sales/quote (and part of SaleResponseDto)
export interface PromotionQuoteResult {
  autoDiscountAmount: number;
  appliedPromotions: AppliedPromotion[];
  // Keys arrive as numeric strings since Dictionary<int,decimal> serializes to a JSON object
  lineDiscountByProductId: Record<string, number>;
  cashbackEarned: number;
  cashbackConfigId: number | null;
  rewardPointsEarned: number;
  rewardPointConfigId: number | null;
  rewardPointsRedeemed: number;
  rewardPointsRedeemedValue: number;
  cashbackRedeemed: number;
  redemptionWarnings: string[];
  combinedDiscountForSale: number;
}

@Injectable({ providedIn: 'root' })
export class SaleService {

  private baseUrl = environment.baseUrl;

  constructor(private http: HttpClient) {}

  createSale(payload: any): Observable<any> {
    return this.http.post(this.baseUrl + '/sales', payload);
  }

  // Read-only preview using the same calc engine as CreateSale, but never writes anything; called debounced from pos-billing.ts
  getPromotionQuote(payload: PromotionQuoteRequest): Observable<{ success: boolean; data: PromotionQuoteResult }> {
    return this.http.post<{ success: boolean; data: PromotionQuoteResult }>(this.baseUrl + '/sales/quote', payload);
  }

  // Opened as a top-level nav (not HttpClient), so it can't carry the auth interceptor's header — token rides as ?access_token= instead, accepted only on this route (see Program.cs JwtBearerEvents.OnMessageReceived / SalesController.GetInvoicePdf)
  getInvoicePdfUrl(saleId: number, token: string | null): string {
    const tokenParam = token ? `?access_token=${encodeURIComponent(token)}` : '';
    return `${this.baseUrl}/sales/${saleId}/invoice-pdf${tokenParam}`;
  }

  // Type-guard for a 409 stock-conflict error response
  static isStockConflict(err: any): err is { error: StockConflictError } {
    return err?.status === 409 && err?.error?.errorCode === 'STOCK_INSUFFICIENT';
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
