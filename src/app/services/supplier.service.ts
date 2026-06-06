import { HttpClient } from '@angular/common/http';
import { Injectable } from '@angular/core';
import { environment } from '../../environments/environment';

@Injectable({ providedIn: 'root' })
export class SupplierService {

  private baseUrl = environment.baseUrl;

  constructor(private http: HttpClient) {}

  createSupplier(payload: any) {
    return this.http.post(this.baseUrl + '/supplier/create', payload);
  }

  getAllSuppliers() {
    return this.http.get(this.baseUrl + '/supplier/all');
  }

  updateSupplier(id: number, payload: any) {
    return this.http.put(`${this.baseUrl}/supplier/${id}`, payload);
  }

  deleteSupplier(id: number) {
    return this.http.delete(`${this.baseUrl}/supplier/${id}`);
  }
}