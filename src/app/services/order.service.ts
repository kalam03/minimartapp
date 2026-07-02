import { Injectable } from '@angular/core';
import { HttpClient, HttpParams } from '@angular/common/http';
import { Observable } from 'rxjs';
import { environment } from '../../environments/environment';

// ── DTOs ──────────────────────────────────────────────────────────────
export interface OrderItemDto {
  orderItemId: number;
  orderId:     number;
  productId:   number;
  productName: string;
  unitType:    string;
  quantity:    number;
  unitPrice:   number;
  total:       number;
}

export interface OrderListDto {
  orderId:       number;
  customerName:  string | null;
  customerPhone: string | null;
  orderDate:     string;
  status:        'New' | 'Processing' | 'Completed' | 'Cancelled';
  notes:         string | null;
  discount:      number;
  transport:     number;
  subTotal:      number;
  grossAmount:   number;
  createdBy:     string | null;
  createdAt:     string;
  itemCount:     number;
}

export interface OrderResponseDto extends OrderListDto {
  items: OrderItemDto[];
}

export interface CreateOrderRequest {
  customerName?:  string;
  customerPhone?: string;
  notes?:         string;
  discount:       number;
  transport:      number;
  items: Array<{
    productId:   number;
    productName: string;
    unitType:    string;
    quantity:    number;
    unitPrice:   number;
    total:       number;
  }>;
}

export interface UpdateOrderStatusRequest {
  status:           string;
  completedSaleId?: number;
}

// ── Service ───────────────────────────────────────────────────────────
@Injectable({ providedIn: 'root' })
export class OrderService {
  private base = `${environment.baseUrl}/order`;

  constructor(private http: HttpClient) {}

  getOrders(
    status?:   string,
    fromDate?: string,
    toDate?:   string
  ): Observable<{ success: boolean; data: OrderListDto[] }> {
    let params = new HttpParams();
    if (status)   params = params.set('status',   status);
    if (fromDate) params = params.set('fromDate', fromDate);
    if (toDate)   params = params.set('toDate',   toDate);
    return this.http.get<any>(this.base, { params });
  }

  getOrderById(id: number): Observable<{ success: boolean; data: OrderResponseDto }> {
    return this.http.get<any>(`${this.base}/${id}`);
  }

  createOrder(req: CreateOrderRequest): Observable<{ success: boolean; message: string; data: { orderId: number; status: string } }> {
    return this.http.post<any>(this.base, req);
  }

  updateOrderStatus(id: number, req: UpdateOrderStatusRequest): Observable<{ success: boolean; message: string }> {
    return this.http.patch<any>(`${this.base}/${id}/status`, req);
  }
}
