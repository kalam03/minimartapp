// customer.service.ts
import { Injectable } from '@angular/core';
import { HttpClient, HttpParams } from '@angular/common/http';
import { Observable } from 'rxjs';
import { environment } from '../../environments/environment';

export interface Customer {
  customerId: number;
  tenantId: number;
  customerName: string;
  phone: string;
  address: string;
  currentBalance: number;
  isActive: boolean;
  createdAt: Date;
}

export interface CustomerFilter {
  tenantId?: number;
  searchTerm?: string;
  isActive?: boolean;
  pageNumber?: number;
  pageSize?: number;
}

export interface CreateCustomerRequest {
  tenantId: number;
  customerName: string;
  phone?: string;
  address?: string;
  currentBalance?: number;
  isActive?: boolean;
}

export interface UpdateCustomerRequest {
  tenantId: number;
  customerName?: string;
  phone?: string;
  address?: string;
  currentBalance?: number;
  isActive?: boolean;
}

export interface UpdateBalanceRequest {
  tenantId: number;
  amount: number;
  operationType: 'ADD' | 'SUBTRACT';
}

export interface CustomerSummary {
  totalCustomers: number;
  activeCustomers: number;
  inactiveCustomers: number;
  totalBalance: number;
  averageBalance: number;
  maxBalance: number;
  minBalance: number;
}

@Injectable({
  providedIn: 'root'
})
export class CustomerService {
  private baseUrl = environment.baseUrl;

  constructor(private http: HttpClient) { }

  // Get all customers with filters
  getAllCustomers(filter?: CustomerFilter): Observable<Customer[]> {
    let params = new HttpParams();
    
    if (filter) {
      if (filter.tenantId) {
        params = params.set('tenantId', filter.tenantId.toString());
      }
    }
    
    return this.http.get<Customer[]>(this.baseUrl + '/customers/all', { params });
  }

  // Get customer by ID
  getCustomerById(id: number): Observable<Customer> {
    return this.http.get<Customer>(`${this.baseUrl}/customers/${id}`);
  }

  // Create customer
  createCustomer(request: CreateCustomerRequest): Observable<Customer> {
    return this.http.post<Customer>(this.baseUrl + '/customers/Create', request);
  }

  // Update customer
  updateCustomer(id: number, request: UpdateCustomerRequest): Observable<Customer> {
    return this.http.put<Customer>(`${this.baseUrl}/customers/${id}`, request);
  }

  // Delete customer (soft delete)
  deleteCustomer(id: number, tenantId: number): Observable<void> {
    let params = new HttpParams().set('tenantId', tenantId.toString());
    return this.http.delete<void>(`${this.baseUrl}/customers/${id}`, { params });
  }

  // Update customer balance
  updateCustomerBalance(id: number, request: UpdateBalanceRequest): Observable<Customer> {
    return this.http.patch<Customer>(`${this.baseUrl}/customers/${id}/balance`, request);
  }

  // Search customers (for dropdown/autocomplete)
  searchCustomers(tenantId: number, searchTerm: string, topCount: number = 10): Observable<Customer[]> {
    let params = new HttpParams()
      .set('tenantId', tenantId.toString())
      .set('searchTerm', searchTerm)
      .set('topCount', topCount.toString());
    
    return this.http.get<Customer[]>(`${this.baseUrl}/customers/search`, { params });
  }

  // Get customer summary for dashboard
  getCustomerSummary(tenantId: number): Observable<CustomerSummary> {
    let params = new HttpParams().set('tenantId', tenantId.toString());
    return this.http.get<CustomerSummary>(`${this.baseUrl}/customers/summary`, { params });
  }

  // Get high balance customers
  getHighBalanceCustomers(tenantId: number, minBalance: number = 1000, topCount: number = 10): Observable<Customer[]> {
    let params = new HttpParams()
      .set('tenantId', tenantId.toString())
      .set('minBalance', minBalance.toString())
      .set('topCount', topCount.toString());
    
    return this.http.get<Customer[]>(`${this.baseUrl}/customers/high-balance`, { params });
  }
}