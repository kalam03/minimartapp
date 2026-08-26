import { HttpClient } from '@angular/common/http';
import { Injectable } from '@angular/core';
import { Observable } from 'rxjs';
import { environment } from '../../environments/environment';

export interface PromotionMaster {
  promotionId: number;
  promotionName: string;
  discountType: 'Percentage' | 'Fixed';
  discountValue: number;
  appliesToAll: boolean;
  startDate: string;
  endDate: string;
  priority: number;
  isActive: boolean;
  createdAt: string;
  imageUrl: string | null;
  description: string | null;
  productIds: number[];
}

export interface SavePromotionMasterRequest {
  promotionName: string;
  discountType: 'Percentage' | 'Fixed';
  discountValue: number;
  appliesToAll: boolean;
  startDate: string;
  endDate: string;
  priority: number;
  isActive: boolean;
  description: string | null;
  productIds: number[];
}

@Injectable({ providedIn: 'root' })
export class PromotionDiscountService {
  private baseUrl = environment.baseUrl;

  constructor(private http: HttpClient) {}

  getAll(): Observable<{ success: boolean; data: PromotionMaster[] }> {
    return this.http.get<any>(`${this.baseUrl}/promotion-discounts`);
  }

  create(payload: SavePromotionMasterRequest): Observable<{ success: boolean; message: string; data: { promotionId: number } }> {
    return this.http.post<any>(`${this.baseUrl}/promotion-discounts`, payload);
  }

  update(id: number, payload: SavePromotionMasterRequest): Observable<{ success: boolean; message: string }> {
    return this.http.put<any>(`${this.baseUrl}/promotion-discounts/${id}`, payload);
  }

  delete(id: number): Observable<{ success: boolean; message: string }> {
    return this.http.delete<any>(`${this.baseUrl}/promotion-discounts/${id}`);
  }

  uploadImage(id: number, file: File): Observable<{ success: boolean; message?: string; data?: { imageUrl: string } }> {
    const formData = new FormData();
    formData.append('file', file, file.name);
    return this.http.post<any>(`${this.baseUrl}/promotion-discounts/${id}/image`, formData);
  }
}
