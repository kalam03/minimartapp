import { HttpClient } from '@angular/common/http';
import { Injectable } from '@angular/core';
import { Observable } from 'rxjs';
import { environment } from '../../environments/environment';

export interface ComboOfferItem {
  comboItemId: number;
  productId: number;
  productName: string;
  requiredQty: number;
  isFreeItem: boolean;
}

export interface ComboOffer {
  comboId: number;
  comboName: string;
  comboType: 'FixedDiscount' | 'PercentageDiscount' | 'FixedPrice';
  discountValue: number | null;
  fixedComboPrice: number | null;
  startDate: string;
  endDate: string;
  priority: number;
  isActive: boolean;
  createdAt: string;
  items: ComboOfferItem[];
}

export interface SaveComboOfferItemRequest {
  productId: number;
  requiredQty: number;
  isFreeItem: boolean;
}

export interface SaveComboOfferRequest {
  comboName: string;
  comboType: 'FixedDiscount' | 'PercentageDiscount' | 'FixedPrice';
  discountValue: number | null;
  fixedComboPrice: number | null;
  startDate: string;
  endDate: string;
  priority: number;
  isActive: boolean;
  items: SaveComboOfferItemRequest[];
}

@Injectable({ providedIn: 'root' })
export class ComboOfferService {
  private baseUrl = environment.baseUrl;

  constructor(private http: HttpClient) {}

  getAll(): Observable<{ success: boolean; data: ComboOffer[] }> {
    return this.http.get<any>(`${this.baseUrl}/combo-offers`);
  }

  create(payload: SaveComboOfferRequest): Observable<{ success: boolean; message: string; data: { comboId: number } }> {
    return this.http.post<any>(`${this.baseUrl}/combo-offers`, payload);
  }

  update(id: number, payload: SaveComboOfferRequest): Observable<{ success: boolean; message: string }> {
    return this.http.put<any>(`${this.baseUrl}/combo-offers/${id}`, payload);
  }

  delete(id: number): Observable<{ success: boolean; message: string }> {
    return this.http.delete<any>(`${this.baseUrl}/combo-offers/${id}`);
  }
}
