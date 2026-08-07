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
  deliveryManCode?: string | null;
  deliveryManName?: string | null;
}

export interface InvoiceReportResponse {
  success: boolean;
  fromDate: string;
  toDate: string;
  data: InvoiceReportDto[];
}

// balance = totalIn - totalOut; paymentMethod is one of cash/bkash/nagad/rocket/bank account/other
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

export interface CustomerPurchaseSummaryDto {
  customerId: number;
  customerName: string;
  phone: string | null;
  invoiceCount: number;
  totalPurchase: number;
}

export interface CustomerPurchaseSummaryResponse {
  success: boolean;
  fromDate: string;
  toDate: string;
  totalCustomers: number;
  totalAmount: number;
  data: CustomerPurchaseSummaryDto[];
}

export interface CustomerReportDetailDto {
  customerId: number;
  customerName: string;
  phone: string | null;
  address: string | null;
  currentDue: number;
  rewardPointBalance: number;
  statement: InvoiceReportDto[];
}

export interface CustomerReportDetailResponse {
  success: boolean;
  fromDate: string;
  toDate: string;
  data: CustomerReportDetailDto;
}

export interface SupplierPurchaseSummaryDto {
  supplierId: number;
  supplierName: string;
  phone: string | null;
  purchaseCount: number;
  totalPurchase: number;
}

export interface SupplierPurchaseSummaryResponse {
  success: boolean;
  fromDate: string;
  toDate: string;
  totalSuppliers: number;
  totalAmount: number;
  data: SupplierPurchaseSummaryDto[];
}

export interface SupplierPurchaseDetailDto {
  purchaseId: number;
  purchaseDate: string | null;
  supplierId: number | null;
  supplierName: string;
  totalAmount: number;
  discount: number;
  netAmount: number;
  paidAmount: number;
  dueAmount: number;
  paymentType: string;
}

export interface SupplierReportDetailDto {
  supplierId: number;
  supplierName: string;
  phone: string | null;
  address: string | null;
  currentDue: number;
  statement: SupplierPurchaseDetailDto[];
}

export interface SupplierReportDetailResponse {
  success: boolean;
  fromDate: string;
  toDate: string;
  data: SupplierReportDetailDto;
}

export interface DeliveryManCollectionSummaryDto {
  deliveryManCode: string;
  deliveryManName: string;
  invoiceCount: number;
  cashAmount: number;
  bkashAmount: number;
  nagadAmount: number;
  rocketAmount: number;
  bankAmount: number;
  otherAmount: number;
  totalCollected: number;
  dueAmount: number;
}

export interface DeliveryManSummaryResponse {
  success: boolean;
  fromDate: string;
  toDate: string;
  totalDeliveryMen: number;
  totalCollected: number;
  totalDue: number;
  data: DeliveryManCollectionSummaryDto[];
}

export interface DeliveryManDetailResponse {
  success: boolean;
  fromDate: string;
  toDate: string;
  deliveryManCode: string;
  deliveryManName: string;
  data: InvoiceReportDto[];
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

  // omit fromDate/toDate for the all-time running balance; pass a range for net movement within it
  getPaymentMethodSummary(fromDate?: string | null, toDate?: string | null): Observable<PaymentMethodSummaryResponse> {
    return this.http.get<PaymentMethodSummaryResponse>(
      `${this.baseUrl}/reports/payment-method-summary${this.buildQuery({ fromDate, toDate })}`
    );
  }

  // PDFs are generated server-side (QuestPDF) and fetched here as a Blob
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

  // minAmount = "above N", maxAmount = "below N"; pass both for a between-range
  getCustomerPurchaseSummary(
    fromDate: string, toDate: string, minAmount?: number | null, maxAmount?: number | null
  ): Observable<CustomerPurchaseSummaryResponse> {
    return this.http.get<CustomerPurchaseSummaryResponse>(
      `${this.baseUrl}/reports/customer-purchase-summary${this.buildQuery({ fromDate, toDate, minAmount, maxAmount })}`
    );
  }

  getCustomerPurchaseSummaryPdf(
    fromDate: string, toDate: string, minAmount?: number | null, maxAmount?: number | null
  ): Observable<Blob> {
    return this.http.get(
      `${this.baseUrl}/reports/customer-purchase-summary/pdf${this.buildQuery({ fromDate, toDate, minAmount, maxAmount })}`,
      { responseType: 'blob' }
    );
  }

  // currentDue/rewardPointBalance are always-current; fromDate/toDate only scope the statement
  getCustomerDetail(customerId: number, fromDate: string, toDate: string): Observable<CustomerReportDetailResponse> {
    return this.http.get<CustomerReportDetailResponse>(
      `${this.baseUrl}/reports/customer-detail/${customerId}${this.buildQuery({ fromDate, toDate })}`
    );
  }

  getCustomerDetailPdf(customerId: number, fromDate: string, toDate: string): Observable<Blob> {
    return this.http.get(
      `${this.baseUrl}/reports/customer-detail/${customerId}/pdf${this.buildQuery({ fromDate, toDate })}`,
      { responseType: 'blob' }
    );
  }

  // minAmount = "above N", maxAmount = "below N"; pass both for a between-range
  getSupplierPurchaseSummary(
    fromDate: string, toDate: string, minAmount?: number | null, maxAmount?: number | null
  ): Observable<SupplierPurchaseSummaryResponse> {
    return this.http.get<SupplierPurchaseSummaryResponse>(
      `${this.baseUrl}/reports/supplier-purchase-summary${this.buildQuery({ fromDate, toDate, minAmount, maxAmount })}`
    );
  }

  getSupplierPurchaseSummaryPdf(
    fromDate: string, toDate: string, minAmount?: number | null, maxAmount?: number | null
  ): Observable<Blob> {
    return this.http.get(
      `${this.baseUrl}/reports/supplier-purchase-summary/pdf${this.buildQuery({ fromDate, toDate, minAmount, maxAmount })}`,
      { responseType: 'blob' }
    );
  }

  // currentDue is always-current; fromDate/toDate only scope the statement
  getSupplierDetail(supplierId: number, fromDate: string, toDate: string): Observable<SupplierReportDetailResponse> {
    return this.http.get<SupplierReportDetailResponse>(
      `${this.baseUrl}/reports/supplier-detail/${supplierId}${this.buildQuery({ fromDate, toDate })}`
    );
  }

  getSupplierDetailPdf(supplierId: number, fromDate: string, toDate: string): Observable<Blob> {
    return this.http.get(
      `${this.baseUrl}/reports/supplier-detail/${supplierId}/pdf${this.buildQuery({ fromDate, toDate })}`,
      { responseType: 'blob' }
    );
  }

  getDeliveryManSummary(fromDate: string, toDate: string): Observable<DeliveryManSummaryResponse> {
    return this.http.get<DeliveryManSummaryResponse>(
      `${this.baseUrl}/reports/delivery-man-summary${this.buildQuery({ fromDate, toDate })}`
    );
  }

  getDeliveryManSummaryPdf(fromDate: string, toDate: string): Observable<Blob> {
    return this.http.get(
      `${this.baseUrl}/reports/delivery-man-summary/pdf${this.buildQuery({ fromDate, toDate })}`,
      { responseType: 'blob' }
    );
  }

  getDeliveryManDetail(deliveryManCode: string, fromDate: string, toDate: string): Observable<DeliveryManDetailResponse> {
    return this.http.get<DeliveryManDetailResponse>(
      `${this.baseUrl}/reports/delivery-man-detail/${encodeURIComponent(deliveryManCode)}${this.buildQuery({ fromDate, toDate })}`
    );
  }

  getDeliveryManDetailPdf(deliveryManCode: string, fromDate: string, toDate: string): Observable<Blob> {
    return this.http.get(
      `${this.baseUrl}/reports/delivery-man-detail/${encodeURIComponent(deliveryManCode)}/pdf${this.buildQuery({ fromDate, toDate })}`,
      { responseType: 'blob' }
    );
  }
}
