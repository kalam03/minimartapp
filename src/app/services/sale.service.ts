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

/** One free line inside a "Buy X, get Y free" combo — see AppliedPromotion.freeItems. */
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
  /** Populated only for a free-item combo — which product(s) went free and their value. */
  freeItems: FreeItemLine[] | null;
}

/** Mirrors PromotionEngineResult — response of POST /sales/quote (and part of SaleResponseDto). */
export interface PromotionQuoteResult {
  autoDiscountAmount: number;
  appliedPromotions: AppliedPromotion[];
  /** Keys arrive as numeric strings — Dictionary<int,decimal> serializes to a JSON object, whose keys are always strings. */
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

  /**
   * Read-only preview of product-discount/combo/cashback/points math for the
   * current cart — same calc engine as CreateSale, but never writes anything.
   * Called (debounced) from pos-billing.ts as the cart/customer/discount
   * change, so the cashier sees the promo discount before finalising the sale.
   */
  getPromotionQuote(payload: PromotionQuoteRequest): Observable<{ success: boolean; data: PromotionQuoteResult }> {
    return this.http.post<{ success: boolean; data: PromotionQuoteResult }>(this.baseUrl + '/sales/quote', payload);
  }

  /**
   * URL for one sale's printable A4 invoice PDF — opened directly in a new
   * tab (window.open/tab.location, NOT an HttpClient blob fetch). A plain
   * top-level navigation can't carry the Authorization header the auth
   * interceptor normally attaches, so the token rides along as
   * ?access_token= instead; the backend only accepts that fallback on this
   * one route (see Program.cs JwtBearerEvents.OnMessageReceived and
   * SalesController.GetInvoicePdf). Used by both the Counter page (auto-open
   * after checkout) and the Invoice Report grid's per-row print button.
   */
  getInvoicePdfUrl(saleId: number, token: string | null): string {
    const tokenParam = token ? `?access_token=${encodeURIComponent(token)}` : '';
    return `${this.baseUrl}/sales/${saleId}/invoice-pdf${tokenParam}`;
  }

  /** Type-guard: returns true if the HTTP error is a stock conflict (409) */
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
