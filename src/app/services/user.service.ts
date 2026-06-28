import { Injectable } from '@angular/core';
import { HttpClient, HttpParams } from '@angular/common/http';
import { Observable } from 'rxjs';
import { environment } from '../../environments/environment';

export interface UserResponse {
  userId: number;
  tenantId: number;
  userName: string;
  role: string;
  isActive: boolean;
  createdAt: string;
  roleNames: string;
}

export interface CreateUserRequest {
  userName: string;
  password: string;
  role: string;
}

export interface UpdateUserRequest {
  userName: string;
  role: string;
  isActive: boolean;
}

export interface ChangePasswordRequest {
  oldPassword?: string;
  newPassword: string;
}

export interface RoleResponse {
  roleId: number;
  roleCode: string;
  roleName: string;
  description: string;
  isActive: boolean;
  createdBy: string;
  createdDate: string;
}

export interface CreateRoleRequest {
  roleCode: string;
  roleName: string;
  description?: string;
}

export interface UpdateRoleRequest {
  roleCode: string;
  roleName: string;
  description?: string;
  isActive: boolean;
}

export interface UserRoleResponse {
  userRoleId: number;
  userId: number;
  roleId: number;
  roleCode: string;
  roleName: string;
  description: string;
  createdBy: string;
  createdDate: string;
}

export interface AssignRoleRequest {
  userId: number;
  roleId: number;
}

@Injectable({ providedIn: 'root' })
export class UserService {
  private baseUrl = `${environment.baseUrl}/users`;

  constructor(private http: HttpClient) {}

  // ── Users ──────────────────────────────────────────────────────────────────

  getUsers(isActive?: boolean, searchTerm?: string): Observable<UserResponse[]> {
    let params = new HttpParams();
    if (isActive !== undefined) params = params.set('isActive', isActive.toString());
    if (searchTerm)             params = params.set('searchTerm', searchTerm);
    return this.http.get<UserResponse[]>(this.baseUrl, { params });
  }

  createUser(dto: CreateUserRequest): Observable<any> {
    return this.http.post<any>(this.baseUrl, dto);
  }

  updateUser(id: number, dto: UpdateUserRequest): Observable<any> {
    return this.http.put<any>(`${this.baseUrl}/${id}`, dto);
  }

  changePassword(userId: number, dto: ChangePasswordRequest): Observable<any> {
    return this.http.put<any>(`${this.baseUrl}/${userId}/change-password`, dto);
  }

  // ── Roles ──────────────────────────────────────────────────────────────────

  getRoles(isActive?: boolean): Observable<RoleResponse[]> {
    let params = new HttpParams();
    if (isActive !== undefined) params = params.set('isActive', isActive.toString());
    return this.http.get<RoleResponse[]>(`${this.baseUrl}/roles`, { params });
  }

  createRole(dto: CreateRoleRequest): Observable<any> {
    return this.http.post<any>(`${this.baseUrl}/roles`, dto);
  }

  updateRole(id: number, dto: UpdateRoleRequest): Observable<any> {
    return this.http.put<any>(`${this.baseUrl}/roles/${id}`, dto);
  }

  // ── UserRoles ──────────────────────────────────────────────────────────────

  getUserRoles(userId: number): Observable<UserRoleResponse[]> {
    return this.http.get<UserRoleResponse[]>(`${this.baseUrl}/${userId}/roles`);
  }

  assignRole(dto: AssignRoleRequest): Observable<any> {
    return this.http.post<any>(`${this.baseUrl}/assign-role`, dto);
  }

  removeRole(userId: number, roleId: number): Observable<any> {
    return this.http.delete<any>(`${this.baseUrl}/remove-role`, {
      body: { userId, roleId }
    });
  }
}
