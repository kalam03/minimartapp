import { HttpClient } from '@angular/common/http';
import { Injectable } from '@angular/core';
import { Observable } from 'rxjs';
import { environment } from '../../environments/environment';

export interface Category {
  categoryId: number;
  tenantId: number;
  categoryName: string;
  isActive: boolean;
  createdAt: string;
}

export interface CreateCategoryRequest {
  categoryName: string;
}

export interface UpdateCategoryRequest extends CreateCategoryRequest {
  isActive: boolean;
}

@Injectable({ providedIn: 'root' })
export class CategoryService {
  private baseUrl = environment.baseUrl;

  constructor(private http: HttpClient) {}

  getAllCategories(isActive?: boolean): Observable<{ success: boolean; data: Category[] }> {
    const params = isActive !== undefined ? `?isActive=${isActive}` : '';
    return this.http.get<any>(`${this.baseUrl}/categories${params}`);
  }

  createCategory(payload: CreateCategoryRequest): Observable<{ success: boolean; message: string; data: Category }> {
    return this.http.post<any>(`${this.baseUrl}/categories`, payload);
  }

  updateCategory(id: number, payload: UpdateCategoryRequest): Observable<{ success: boolean; message: string }> {
    return this.http.put<any>(`${this.baseUrl}/categories/${id}`, payload);
  }

  deleteCategory(id: number): Observable<{ success: boolean; message: string }> {
    return this.http.delete<any>(`${this.baseUrl}/categories/${id}`);
  }
}
