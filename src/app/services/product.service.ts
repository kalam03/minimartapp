import { Injectable } from '@angular/core';
import { HttpClient, HttpParams } from '@angular/common/http';
import { Observable } from 'rxjs';
import { Product, ProductFilter } from '../models/product';
import { environment } from '../../environments/environment';

@Injectable({
  providedIn: 'root'
})
export class ProductService {
     public readonly baseUrl: string;
  constructor(private http: HttpClient) {
    this.baseUrl = environment.baseUrl;
  }

  getAllProducts(filter?: ProductFilter): Observable<Product[]> {
    let params = new HttpParams();

    if (filter) {
      if (filter.tenantId !== null && filter.tenantId !== undefined) {
        params = params.set('tenantId', filter.tenantId.toString());
      }
      if (filter.isActive !== null && filter.isActive !== undefined) {
        params = params.set('isActive', filter.isActive.toString());
      }
      if (filter.categoryId !== null && filter.categoryId !== undefined) {
        params = params.set('categoryId', filter.categoryId.toString());
      }
      if (filter.fromDate) {
        params = params.set('fromDate', filter.fromDate);
      }
      if (filter.toDate) {
        params = params.set('toDate', filter.toDate);
      }
    }

    return this.http.get<Product[]>(this.baseUrl + '/products/all', { params });
  }

  getProductsByTenant(tenantId: number): Observable<Product[]> {
    return this.getAllProducts({ tenantId, isActive: true });
  }

  getActiveProducts(): Observable<Product[]> {
    return this.getAllProducts({ isActive: true });
  }

  getProductsByCategory(categoryId: number): Observable<Product[]> {
    return this.getAllProducts({ categoryId, isActive: true });
  }

  getLowStockProducts(): Observable<Product[]> {
    return new Observable(observer => {
      this.getAllProducts({ isActive: true }).subscribe(products => {
        const lowStockProducts = products.filter(p => p.stockStatus === 'Low Stock' || p.stockStatus === 'Out of Stock');
        observer.next(lowStockProducts);
        observer.complete();
      });
    });
  }

  createProduct(payload: any): Observable<Product> {
    return this.http.post<Product>(this.baseUrl + '/products/Create', payload);
  }

  updateProduct(id: number, payload: any): Observable<Product> {
    return this.http.put<Product>(`${this.baseUrl}/products/${id}`, payload);
  }

  deleteProduct(id: number): Observable<void> {
    return this.http.delete<void>(`${this.baseUrl}/products/${id}`);
  }

  // Separate from create/update on purpose — the backend endpoint (POST /products/{id}/image)
  // takes multipart/form-data, not JSON, and needs an existing ProductId to name the saved file
  // after. So the create/edit flow is: save the product fields first (create or update), then
  // call this with the resulting id and the picked File.
  uploadProductImage(id: number, file: File): Observable<{ success: boolean; message?: string; data?: { imageUrl: string } }> {
    const formData = new FormData();
    formData.append('file', file, file.name);
    return this.http.post<{ success: boolean; message?: string; data?: { imageUrl: string } }>(
      `${this.baseUrl}/products/${id}/image`, formData
    );
  }
}
