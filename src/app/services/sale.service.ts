import { HttpClient } from '@angular/common/http';
import { Injectable } from '@angular/core';

@Injectable({ providedIn: 'root' })
export class SaleService {

  private baseUrl = 'https://localhost:7097/api';

  constructor(private http: HttpClient) {}

  createSale(payload: any) {
    return this.http.post(this.baseUrl, payload);
  }
}