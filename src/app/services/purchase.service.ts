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

@Injectable({
  providedIn: 'root'
})
export class PurchaseService {
private baseUrl = environment.baseUrl;

  constructor(private http: HttpClient) {}

  // =========================
  // CREATE PURCHASE
  // =========================
  createPurchase(payload: any): Observable<PurchaseResponseDto> {
    return this.http.post<PurchaseResponseDto>(this.baseUrl+"/purchases", payload);
  }

  // =========================
  // GET ALL PURCHASES
  // =========================
  getPurchases(): Observable<PurchaseResponseDto[]> {
    return this.http.get<PurchaseResponseDto[]>(this.baseUrl);
  }

  // =========================
  // GET PURCHASE BY ID
  // =========================
  getPurchaseById(id: number): Observable<PurchaseResponseDto> {
    return this.http.get<PurchaseResponseDto>(`${this.baseUrl}/${id}`);
  }

  // =========================
  // DELETE PURCHASE (optional)
  // =========================
  deletePurchase(id: number): Observable<any> {
    return this.http.delete(`${this.baseUrl}/${id}`);
  }
}