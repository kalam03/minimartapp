// services/product.service.ts
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
    }

    return this.http.get<Product[]>(this.baseUrl + '/products/all', { params });
  }

  // Get products by tenant
  getProductsByTenant(tenantId: number): Observable<Product[]> {
    return this.getAllProducts({ tenantId, isActive: true });
  }

  // Get active products only
  getActiveProducts(): Observable<Product[]> {
    return this.getAllProducts({ isActive: true });
  }

  // Get products by category
  getProductsByCategory(categoryId: number): Observable<Product[]> {
    return this.getAllProducts({ categoryId, isActive: true });
  }

  // Get low stock products
  getLowStockProducts(): Observable<Product[]> {
    return new Observable(observer => {
      this.getAllProducts({ isActive: true }).subscribe(products => {
        const lowStockProducts = products.filter(p => p.stockStatus === 'Low Stock' || p.stockStatus === 'Out of Stock');
        observer.next(lowStockProducts);
        observer.complete();
      });
    });
  }

  // Create product
  createProduct(payload: any): Observable<Product> {
    return this.http.post<Product>(this.baseUrl + '/products/Create', payload);
  }

  // Update product
  updateProduct(id: number, payload: any): Observable<Product> {
    return this.http.put<Product>(`${this.baseUrl}/products/${id}`, payload);
  }

  // Delete product
  deleteProduct(id: number): Observable<void> {
    return this.http.delete<void>(`${this.baseUrl}/products/${id}`);
  }
}
