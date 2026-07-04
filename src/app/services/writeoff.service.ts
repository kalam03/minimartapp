import { HttpClient } from '@angular/common/http';
import { Injectable } from '@angular/core';
import { Observable } from 'rxjs';
import { environment } from '../../environments/environment';

export interface WriteOff {
  writeOffId: number;
  tenantId: number;
  productId: number;
  productName: string;
  unitType: string;
  quantity: number;
  unitCost: number;
  totalValue: number;
  reason: string;
  writeOffDate: string;
  createdBy?: string;
}

export interface CreateWriteOffRequest {
  productId: number;
  quantity: number;
  reason: string;
  writeOffDate?: string;
}

export interface WriteOffReportResponse {
  success: boolean;
  totalCount: number;
  grandTotalQty: number;
  grandTotalValue: number;
  data: WriteOff[];
}

@Injectable({ providedIn: 'root' })
export class WriteOffService {
  private baseUrl = environment.baseUrl;

  constructor(private http: HttpClient) {}

  createWriteOff(payload: CreateWriteOffRequest): Observable<{ success: boolean; message: string; data: WriteOff }> {
    return this.http.post<any>(`${this.baseUrl}/writeoffs`, payload);
  }

  getReport(fromDate?: string, toDate?: string, productId?: number): Observable<WriteOffReportResponse> {
    const params: Record<string, string> = {};
    if (fromDate) params['fromDate'] = fromDate;
    if (toDate) params['toDate'] = toDate;
    if (productId) params['productId'] = productId.toString();

    const query = new URLSearchParams(params).toString();
    return this.http.get<WriteOffReportResponse>(`${this.baseUrl}/writeoffs/report${query ? '?' + query : ''}`);
  }
}
