import { Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable } from 'rxjs';
import { environment } from '../../environments/environment';

export interface PurchaseItemDto {
  productId: number;
  quantity: number;
  costPrice: number;
}

export interface PurchaseRequestDto {
  supplierName: string;
  purchaseDate: string;
  totalAmount: number;
  items: PurchaseItemDto[];
}

export interface PurchaseResponseDto {
  purchaseId: number;
  supplierName: string;
  purchaseDate: string;
  totalAmount: number;
}

export interface PurchaseSummaryDto {
  totalInvoices: number;
  totalPurchase: number;
  totalDiscount: number;
  totalTransport: number;
  totalNetAmount: number;
  totalPaid: number;
  totalDue: number;
  totalReturn: number;
}

@Injectable({
  providedIn: 'root'
})
export class PurchaseService {
  private baseUrl = environment.baseUrl;

  constructor(private http: HttpClient) {}

  createPurchase(payload: any): Observable<PurchaseResponseDto> {
    return this.http.post<PurchaseResponseDto>(this.baseUrl + '/purchases', payload);
  }

  getPurchases(): Observable<PurchaseResponseDto[]> {
    return this.http.get<PurchaseResponseDto[]>(this.baseUrl);
  }

  getPurchaseById(id: number): Observable<PurchaseResponseDto> {
    return this.http.get<PurchaseResponseDto>(`${this.baseUrl}/${id}`);
  }

  deletePurchase(id: number): Observable<any> {
    return this.http.delete(`${this.baseUrl}/${id}`);
  }

  getPurchaseSummary(fromDate: string, toDate: string): Observable<{ success: boolean; data: PurchaseSummaryDto }> {
    return this.http.get<{ success: boolean; data: PurchaseSummaryDto }>(
      `${this.baseUrl}/purchases/summary?fromDate=${fromDate}&toDate=${toDate}`
    );
  }

  // Purchase-side mirror of SaleService.getInvoicePdfUrl; opened via window.open so the token rides as ?access_token=
  // since a new-tab navigation can't carry an Authorization header (see Program.cs OnMessageReceived)
  getInvoicePdfUrl(purchaseId: number, token: string | null): string {
    const tokenParam = token ? `?access_token=${encodeURIComponent(token)}` : '';
    return `${this.baseUrl}/purchases/${purchaseId}/invoice-pdf${tokenParam}`;
  }
}