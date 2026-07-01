import { Routes } from '@angular/router';
import { LayoutComponent } from './layout/layout.component';
import { AuthGuard } from './services/auth.guard';

export const routes: Routes = [
  {
    path: 'login',
    loadComponent: () =>
      import('./features/auth/login.component').then((m) => m.LoginComponent),
  },
  {
    path: '',
    component: LayoutComponent,
    canActivate: [AuthGuard],
    children: [
      { path: '', redirectTo: 'dashboard', pathMatch: 'full' },
      {
        path: 'dashboard',
        loadComponent: () =>
          import('./features/dashboard/dashboard.component').then((m) => m.DashboardComponent),
      },
      {
        path: 'pos',
        loadComponent: () =>
          import('./features/pos-billing/pos-billing').then((m) => m.PosBillingComponent),
      },
      {
        path: 'Purchases',
        loadComponent: () =>
          import('./features/purchases/purchase.component').then((m) => m.PurchaseComponent),
      },
      {
        path: 'suppliers',
        loadComponent: () =>
          import('./features/suppliers/supplier.component').then((m) => m.SupplierComponent),
      },
      {
        path: 'customers',
        loadComponent: () =>
          import('./features/customers/customer.component').then((m) => m.CustomerComponent),
      },
      {
        path: 'products',
        loadComponent: () =>
          import('./features/products/product.component').then((m) => m.ProductComponent),
      },
      // ── Security Module ──────────────────────────────────────────────────
      {
        path: 'security/users',
        loadComponent: () =>
          import('./features/security/user-management.component').then(
            (m) => m.UserManagementComponent
          ),
      },
      {
        path: 'security/roles',
        loadComponent: () =>
          import('./features/security/role-management.component').then(
            (m) => m.RoleManagementComponent
          ),
      },
      {
        path: 'capital',
        loadComponent: () =>
          import('./features/capital/capital-management.component').then(
            (m) => m.CapitalManagementComponent
          ),
      },
    ],
  },
  { path: '**', redirectTo: 'dashboard' },
];
