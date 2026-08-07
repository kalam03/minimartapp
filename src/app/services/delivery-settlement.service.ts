import { HttpClient } from '@angular/common/http';
import { Injectable } from '@angular/core';
import { Observable } from 'rxjs';
import { environment } from '../../environments/environment';

// Mirrors MiniMartApi.Entities.DeliverySettlementDto — see Services/DeliverySettlementService.cs
export interface DeliverySettlementDto {
  deliverySettlementId: number;
  saleId: number;
  invoiceNo: string;
  deliveryManCode: string;
  deliveryManName: string;
  customerName: string;
  invoicedMethod: string;
  invoicedAmount: number;
  collectedAmount: number;
  collectedMethod: string;
  status: 'Pending' | 'Verified' | 'Disputed';
  remarks?: string | null;
  submittedBy?: string | null;
  submittedAt: string;
  verifiedBy?: string | null;
  verifiedAt?: string | null;
  amountMismatch: boolean;
  mismatchAmount: number;
}

export interface CreateDeliverySettlementRequest {
  saleId: number;
  collectedAmount: number;
  collectedMethod: string;
  remarks?: string;
}

@Injectable({ providedIn: 'root' })
export class DeliverySettlementService {

  private baseUrl = environment.baseUrl;

  constructor(private http: HttpClient) {}

  getBySale(saleId: number): Observable<{ success: boolean; data: DeliverySettlementDto[] }> {
    return this.http.get<{ success: boolean; data: DeliverySettlementDto[] }>(`${this.baseUrl}/delivery-settlements/by-sale/${saleId}`);
  }

  getPendingCounts(): Observable<{ success: boolean; data: Record<string, number> }> {
    return this.http.get<{ success: boolean; data: Record<string, number> }>(`${this.baseUrl}/delivery-settlements/pending-counts`);
  }

  create(payload: CreateDeliverySettlementRequest): Observable<{ success: boolean; message: string; data: DeliverySettlementDto }> {
    return this.http.post<{ success: boolean; message: string; data: DeliverySettlementDto }>(`${this.baseUrl}/delivery-settlements`, payload);
  }

  verify(id: number, remarks?: string): Observable<{ success: boolean; message: string; data: DeliverySettlementDto }> {
    return this.http.post<{ success: boolean; message: string; data: DeliverySettlementDto }>(`${this.baseUrl}/delivery-settlements/${id}/verify`, { remarks });
  }

  dispute(id: number, remarks: string): Observable<{ success: boolean; message: string; data: DeliverySettlementDto }> {
    return this.http.post<{ success: boolean; message: string; data: DeliverySettlementDto }>(`${this.baseUrl}/delivery-settlements/${id}/dispute`, { remarks });
  }
}
