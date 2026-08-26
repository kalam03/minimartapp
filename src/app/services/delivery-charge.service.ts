import { HttpClient } from '@angular/common/http';
import { Injectable } from '@angular/core';
import { Observable } from 'rxjs';
import { environment } from '../../environments/environment';

export interface DeliveryZone {
  zoneId: number;
  zoneName: string;
  charge: number;
  displayOrder: number;
  isActive: boolean;
  createdAt: string;
}

export interface SaveDeliveryZoneRequest {
  zoneName: string;
  charge: number;
  displayOrder: number;
  isActive: boolean;
}

export interface DeliveryCustomerRate {
  deliveryCustomerRateId: number;
  customerId: number;
  customerName: string;
  phone: string;
  isFree: boolean;
  charge: number;
  notes: string | null;
  isActive: boolean;
  createdAt: string;
}

export interface SaveDeliveryCustomerRateRequest {
  customerId: number;
  isFree: boolean;
  charge: number;
  notes: string | null;
  isActive: boolean;
}

export interface DeliveryCategorySurcharge {
  deliveryCategorySurchargeId: number;
  categoryId: number;
  categoryName: string;
  surchargeAmount: number;
  isActive: boolean;
  createdAt: string;
}

export interface SaveDeliveryCategorySurchargeRequest {
  categoryId: number;
  surchargeAmount: number;
  isActive: boolean;
}

@Injectable({ providedIn: 'root' })
export class DeliveryChargeService {
  private baseUrl = `${environment.baseUrl}/delivery-charges`;

  constructor(private http: HttpClient) {}

  // ── Zones ──────────────────────────────────────────────────────────────
  getZones(): Observable<{ success: boolean; data: DeliveryZone[] }> {
    return this.http.get<any>(`${this.baseUrl}/zones`);
  }
  createZone(payload: SaveDeliveryZoneRequest): Observable<{ success: boolean; message: string; data: { zoneId: number } }> {
    return this.http.post<any>(`${this.baseUrl}/zones`, payload);
  }
  updateZone(id: number, payload: SaveDeliveryZoneRequest): Observable<{ success: boolean; message: string }> {
    return this.http.put<any>(`${this.baseUrl}/zones/${id}`, payload);
  }
  deleteZone(id: number): Observable<{ success: boolean; message: string }> {
    return this.http.delete<any>(`${this.baseUrl}/zones/${id}`);
  }

  // ── Customer rates ────────────────────────────────────────────────────
  getCustomerRates(): Observable<{ success: boolean; data: DeliveryCustomerRate[] }> {
    return this.http.get<any>(`${this.baseUrl}/customer-rates`);
  }
  createCustomerRate(payload: SaveDeliveryCustomerRateRequest): Observable<{ success: boolean; message: string; data: { deliveryCustomerRateId: number } }> {
    return this.http.post<any>(`${this.baseUrl}/customer-rates`, payload);
  }
  updateCustomerRate(id: number, payload: SaveDeliveryCustomerRateRequest): Observable<{ success: boolean; message: string }> {
    return this.http.put<any>(`${this.baseUrl}/customer-rates/${id}`, payload);
  }
  deleteCustomerRate(id: number): Observable<{ success: boolean; message: string }> {
    return this.http.delete<any>(`${this.baseUrl}/customer-rates/${id}`);
  }

  // ── Category surcharges ──────────────────────────────────────────────
  getCategorySurcharges(): Observable<{ success: boolean; data: DeliveryCategorySurcharge[] }> {
    return this.http.get<any>(`${this.baseUrl}/category-surcharges`);
  }
  createCategorySurcharge(payload: SaveDeliveryCategorySurchargeRequest): Observable<{ success: boolean; message: string; data: { deliveryCategorySurchargeId: number } }> {
    return this.http.post<any>(`${this.baseUrl}/category-surcharges`, payload);
  }
  updateCategorySurcharge(id: number, payload: SaveDeliveryCategorySurchargeRequest): Observable<{ success: boolean; message: string }> {
    return this.http.put<any>(`${this.baseUrl}/category-surcharges/${id}`, payload);
  }
  deleteCategorySurcharge(id: number): Observable<{ success: boolean; message: string }> {
    return this.http.delete<any>(`${this.baseUrl}/category-surcharges/${id}`);
  }
}
