import { HttpClient } from '@angular/common/http';
import { Injectable } from '@angular/core';
import { environment } from '../../environments/environment';

@Injectable({ providedIn: 'root' })
export class SupplierService {

  private baseUrl = environment.baseUrl;

  constructor(private http: HttpClient) {}

  // Create new supplier
  createSupplier(payload: any) {
    return this.http.post(this.baseUrl + '/supplier/create', payload);
  }
  getAllSuppliers(){
     return this.http.get(this.baseUrl + '/supplier/all');
  }
}