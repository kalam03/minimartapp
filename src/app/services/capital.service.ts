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
}

@Injectable({ providedIn: 'root' })
export class CapitalService {
  private baseUrl = environment.baseUrl;

  constructor(private http: HttpClient) {}

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
}
