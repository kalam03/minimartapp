import { HttpClient } from '@angular/common/http';
import { Injectable } from '@angular/core';
import { Observable } from 'rxjs';
import { environment } from '../../environments/environment';

export interface AppResource {
  resourceId:     number;
  functionId:     string;
  functionName:   string;
  menuId:         string;
  menuName:       string;
  moduleId:       string;
  moduleName:     string;
  appRoute:       string;
  icon:           string;
  itemType:       string;
  quickRouteNo:   string;
  isFinancial:    boolean;
  sortOrder:      number;
}

export interface UserPermissionRow extends AppResource {
  allowMaintAdd:     boolean;
  allowMaintEdit:    boolean;
  allowMaintDel:     boolean;
  allowMaintView:    boolean;
  allowMaintAuth:    boolean;
  allowProcess:      boolean;
  allowReportView:   boolean;
  allowReportPrint:  boolean;
  allowReportGen:    boolean;
  allowAnyOfficeOps: boolean;
}

export interface UserListItem {
  userId:   number;
  userName: string;
  role:     string;
  isActive: boolean;
}

export interface MyMenuItem {
  functionId:   string;
  functionName: string;
  appRoute:     string;
  icon:         string;
  moduleId:     string;
  moduleName:   string;
  menuId:       string;
  menuName:     string;
  sortOrder:    number;
  isFinancial:  boolean;
  quickRouteNo: string;
}

export interface SavePermissionsRequest {
  userId:      number;
  permissions: Array<{
    functionId:       string;
    allowMaintAdd:    boolean;
    allowMaintEdit:   boolean;
    allowMaintDel:    boolean;
    allowMaintView:   boolean;
    allowMaintAuth:   boolean;
    allowProcess:     boolean;
    allowReportView:  boolean;
    allowReportPrint: boolean;
    allowReportGen:   boolean;
    allowAnyOfficeOps:boolean;
  }>;
}

@Injectable({ providedIn: 'root' })
export class PermissionService {
  private base = environment.baseUrl + '/userpermission';

  constructor(private http: HttpClient) {}

  getUsers(): Observable<{ success: boolean; data: UserListItem[] }> {
    return this.http.get<any>(`${this.base}/users`);
  }

  getUserPermissions(userId: number): Observable<{ success: boolean; data: UserPermissionRow[] }> {
    return this.http.get<any>(`${this.base}/${userId}`);
  }

  savePermissions(request: SavePermissionsRequest): Observable<{ success: boolean; message: string }> {
    return this.http.post<any>(`${this.base}/save`, request);
  }

  getMyMenus(): Observable<{ success: boolean; data: MyMenuItem[] }> {
    return this.http.get<any>(`${this.base}/my-menus`);
  }
}
