import { HttpClient } from '@angular/common/http';
import { Injectable } from '@angular/core';
import { Observable } from 'rxjs';
import { environment } from '../../environments/environment';

export interface CapitalTransactionDto {
  glTransactionId: number;
  txnNo: string;
  txnDate: string;
  txnTypeId: number;
  txnCode: string;
  txnName: string;
  referenceNo?: string;
  txnMode?: string;
  glAccount: string;
  drCr: string;
  amount: number;
  currencyCode?: string;
  customerId?: number;
  customerName?: string;
  vendorId?: number;
  supplierName?: string;
  employeeId?: number;
  employeeName?: string;
  investorId?: number;
  investorName?: string;
  narration?: string;
  authStatus?: string;
  createdBy: string;
  totalCount: number;
  totalDebit: number;
  totalCredit: number;
}

export interface CreateCapitalTransactionRequest {
  txnTypeId: number;
  txnDate: string;
  glAccount: string;
  drCr: string;
  amount: number;
  referenceNo?: string;
  txnMode?: string;
  narration?: string;
  customerId?: number;
  vendorId?: number;
}

@Injectable({ providedIn: 'root' })
export class CapitalService {
  private baseUrl = environment.baseUrl;

  constructor(private http: HttpClient) {}

  getTenantInfo(): Observable<{ success: boolean; data: { tenantId: number; tenantName: string; phone?: string; contactPerson?: string } }> {
    return this.http.get<any>(`${this.baseUrl}/capital/tenant-info`);
  }

  getTransactions(
    search: string,
    drCr: string,
    txnTypeId: number,
    fromDate: string,
    toDate: string,
    pageNo: number,
    pageSize: number
  ): Observable<{ success: boolean; totalCount: number; totalDebit: number; totalCredit: number; data: CapitalTransactionDto[] }> {
    const params = new URLSearchParams({
      search:    search,
      drCr:      drCr,
      txnTypeId: txnTypeId.toString(),
      fromDate:  fromDate,
      toDate:    toDate,
      pageNo:    pageNo.toString(),
      pageSize:  pageSize.toString()
    });
    return this.http.get<any>(`${this.baseUrl}/capital?${params.toString()}`);
  }

  createTransaction(req: CreateCapitalTransactionRequest): Observable<{ success: boolean; data: any }> {
    return this.http.post<any>(`${this.baseUrl}/capital`, req);
  }

  getCategoryTotals(fromDate: string, toDate: string): Observable<{
    success: boolean;
    fromDate: string;
    toDate: string;
    data: CapitalCategoryTotal[];
  }> {
    const params = new URLSearchParams();
    if (fromDate) params.set('fromDate', fromDate);
    if (toDate) params.set('toDate', toDate);
    const query = params.toString();
    return this.http.get<any>(`${this.baseUrl}/capital/category-totals${query ? '?' + query : ''}`);
  }

  getDailyCashRegister(fromDate: string, toDate: string): Observable<{
    success: boolean;
    fromDate: string;
    toDate: string;
    openingBalance: number;
    closingBalance: number;
    data: DailyCashRegisterRow[];
  }> {
    const params = new URLSearchParams();
    if (fromDate) params.set('fromDate', fromDate);
    if (toDate) params.set('toDate', toDate);
    const query = params.toString();
    return this.http.get<any>(`${this.baseUrl}/capital/daily-cash-register${query ? '?' + query : ''}`);
  }
}

export interface CapitalCategoryTotal {
  txnTypeId: number;
  txnCode: string;
  txnName: string;
  totalCredit: number;
  totalDebit: number;
  txnCount: number;
}

export interface DailyCashRegisterRow {
  txnDate: string;
  openingBalance: number;
  totalCredit: number;
  totalDebit: number;
  netChange: number;
  closingBalance: number;
}
