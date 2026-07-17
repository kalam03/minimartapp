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

export interface SalesSummaryDto {
  totalInvoices: number;
  totalSales: number;
  totalDiscount: number;
  totalTransport: number;
  totalNetAmount: number;
  totalPaid: number;
  totalDue: number;
}

export interface SalesSummaryResponse {
  success: boolean;
  fromDate: string;
  toDate: string;
  data: SalesSummaryDto;
}

export interface SalesDetailDto {
  saleId: number;
  invoiceNo: string;
  saleDate: string;
  customerId: number | null;
  customerName: string;
  productId: number | null;
  productName: string;
  unitType: string;
  quantity: number;
  unitPrice: number;
  total: number;
}

export interface SalesDetailsResponse {
  success: boolean;
  fromDate: string;
  toDate: string;
  data: SalesDetailDto[];
}

export interface InvoiceReportDto {
  saleId: number;
  invoiceNo: string;
  saleDate: string;
  customerId: number | null;
  customerName: string;
  totalAmount: number;
  discount: number;
  transportCost: number;
  netAmount: number;
  paidAmount: number;
  dueAmount: number;
  returnAmount: number;
  paymentType: string;
}

export interface InvoiceReportResponse {
  success: boolean;
  fromDate: string;
  toDate: string;
  data: InvoiceReportDto[];
}

// One row per canonical payment method ('cash'/'bkash'/'nagad'/'rocket'/
// 'bank account', plus 'other' for any unrecognized legacy value). Balance
// = TotalIn - TotalOut = how much is currently "in" that payment method.
export interface PaymentMethodSummaryDto {
  paymentMethod: string;
  totalIn: number;
  totalOut: number;
  balance: number;
}

export interface PaymentMethodSummaryResponse {
  success: boolean;
  fromDate: string | null;
  toDate: string | null;
  data: PaymentMethodSummaryDto[];
}

@Injectable({ providedIn: 'root' })
export class ReportsService {
  private baseUrl = environment.baseUrl;

  constructor(private http: HttpClient) {}

  private buildQuery(params: Record<string, string | number | null | undefined>): string {
    const search = new URLSearchParams();
    Object.entries(params).forEach(([key, value]) => {
      if (value !== null && value !== undefined && value !== '') {
        search.set(key, value.toString());
      }
    });
    const query = search.toString();
    return query ? `?${query}` : '';
  }

  getProfitByDate(fromDate: string, toDate: string): Observable<ProfitByDateResponse> {
    return this.http.get<ProfitByDateResponse>(
      `${this.baseUrl}/reports/profit-by-date${this.buildQuery({ fromDate, toDate })}`
    );
  }

  getSalesSummary(fromDate: string, toDate: string): Observable<SalesSummaryResponse> {
    return this.http.get<SalesSummaryResponse>(
      `${this.baseUrl}/reports/sales-summary${this.buildQuery({ fromDate, toDate })}`
    );
  }

  getSalesDetails(fromDate: string, toDate: string, customerId?: number | null): Observable<SalesDetailsResponse> {
    return this.http.get<SalesDetailsResponse>(
      `${this.baseUrl}/reports/sales-details${this.buildQuery({ fromDate, toDate, customerId })}`
    );
  }

  getInvoiceReport(fromDate: string, toDate: string, customerId?: number | null): Observable<InvoiceReportResponse> {
    return this.http.get<InvoiceReportResponse>(
      `${this.baseUrl}/reports/invoice-report${this.buildQuery({ fromDate, toDate, customerId })}`
    );
  }

  // fromDate/toDate are OPTIONAL — omit both for the all-time running
  // balance ("how much is in X right now"); supply a range to see net
  // movement within just that period instead.
  getPaymentMethodSummary(fromDate?: string | null, toDate?: string | null): Observable<PaymentMethodSummaryResponse> {
    return this.http.get<PaymentMethodSummaryResponse>(
      `${this.baseUrl}/reports/payment-method-summary${this.buildQuery({ fromDate, toDate })}`
    );
  }

  // ── PDF exports — generated server-side (QuestPDF); these just fetch the
  // finished file as a Blob for the browser to download. ────────────────
  getSalesSummaryPdf(fromDate: string, toDate: string): Observable<Blob> {
    return this.http.get(
      `${this.baseUrl}/reports/sales-summary/pdf${this.buildQuery({ fromDate, toDate })}`,
      { responseType: 'blob' }
    );
  }

  getSalesDetailsPdf(fromDate: string, toDate: string, customerId?: number | null): Observable<Blob> {
    return this.http.get(
      `${this.baseUrl}/reports/sales-details/pdf${this.buildQuery({ fromDate, toDate, customerId })}`,
      { responseType: 'blob' }
    );
  }

  getInvoiceReportPdf(fromDate: string, toDate: string, customerId?: number | null): Observable<Blob> {
    return this.http.get(
      `${this.baseUrl}/reports/invoice-report/pdf${this.buildQuery({ fromDate, toDate, customerId })}`,
      { responseType: 'blob' }
    );
  }

  getProfitByDatePdf(fromDate: string, toDate: string): Observable<Blob> {
    return this.http.get(
      `${this.baseUrl}/reports/profit-by-date/pdf${this.buildQuery({ fromDate, toDate })}`,
      { responseType: 'blob' }
    );
  }

  getPaymentMethodSummaryPdf(fromDate?: string | null, toDate?: string | null): Observable<Blob> {
    return this.http.get(
      `${this.baseUrl}/reports/payment-method-summary/pdf${this.buildQuery({ fromDate, toDate })}`,
      { responseType: 'blob' }
    );
  }
}
