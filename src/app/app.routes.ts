import { Routes } from '@angular/router';
import { LayoutComponent } from './layout/layout.component';
import { AuthGuard } from './services/auth.guard';
import { PermissionGuard } from './services/permission.guard';

export const routes: Routes = [
  {
    path: 'login',
    loadComponent: () =>
      import('./features/auth/login.component').then((m) => m.LoginComponent),
  },
  {
    // Standalone access-denied page — no PermissionGuard needed here
    path: 'no-access',
    loadComponent: () =>
      import('./features/no-access/no-access.component').then((m) => m.NoAccessComponent),
  },
  {
    path: '',
    component: LayoutComponent,
    canActivate: [AuthGuard],
    children: [
      { path: '', redirectTo: 'dashboard', pathMatch: 'full' },
      {
        path: 'dashboard',
        // Dashboard is always allowed — PermissionGuard also whitelists it
        canActivate: [PermissionGuard],
        loadComponent: () =>
          import('./features/dashboard/dashboard.component').then((m) => m.DashboardComponent),
      },
      {
        path: 'pos',
        canActivate: [PermissionGuard],
        loadComponent: () =>
          import('./features/pos-billing/pos-billing').then((m) => m.PosBillingComponent),
      },
      {
        path: 'Purchases',
        canActivate: [PermissionGuard],
        loadComponent: () =>
          import('./features/purchases/purchase.component').then((m) => m.PurchaseComponent),
      },
      {
        path: 'suppliers',
        canActivate: [PermissionGuard],
        loadComponent: () =>
          import('./features/suppliers/supplier.component').then((m) => m.SupplierComponent),
      },
      {
        path: 'customers',
        canActivate: [PermissionGuard],
        loadComponent: () =>
          import('./features/customers/customer.component').then((m) => m.CustomerComponent),
      },
      {
        path: 'products',
        canActivate: [PermissionGuard],
        loadComponent: () =>
          import('./features/products/product.component').then((m) => m.ProductComponent),
      },
      {
        path: 'unit-types',
        canActivate: [PermissionGuard],
        loadComponent: () =>
          import('./features/unit-types/unit-type.component').then((m) => m.UnitTypeComponent),
      },
      {
        path: 'categories',
        canActivate: [PermissionGuard],
        loadComponent: () =>
          import('./features/categories/category.component').then((m) => m.CategoryComponent),
      },
      {
        path: 'barcode-generator',
        canActivate: [PermissionGuard],
        loadComponent: () =>
          import('./features/barcode-generator/barcode-generator.component').then(
            (m) => m.BarcodeGeneratorComponent
          ),
      },
      // ── Security Module ──────────────────────────────────────────────────
      {
        path: 'security/users',
        canActivate: [PermissionGuard],
        loadComponent: () =>
          import('./features/security/user-management.component').then(
            (m) => m.UserManagementComponent
          ),
      },
      {
        path: 'security/roles',
        canActivate: [PermissionGuard],
        loadComponent: () =>
          import('./features/security/role-management.component').then(
            (m) => m.RoleManagementComponent
          ),
      },
      {
        path: 'security/permissions',
        canActivate: [PermissionGuard],
        loadComponent: () =>
          import('./features/user-permission/user-permission.component').then(
            (m) => m.UserPermissionComponent
          ),
      },
      {
        path: 'capital',
        canActivate: [PermissionGuard],
        loadComponent: () =>
          import('./features/capital/capital-management.component').then(
            (m) => m.CapitalManagementComponent
          ),
      },
      {
        path: 'writeoffs',
        canActivate: [PermissionGuard],
        loadComponent: () =>
          import('./features/writeoffs/writeoff.component').then(
            (m) => m.WriteOffComponent
          ),
      },
      {
        path: 'employees',
        canActivate: [PermissionGuard],
        loadComponent: () =>
          import('./features/payroll/payroll.component').then(
            (m) => m.PayrollComponent
          ),
      },
      {
        path: 'investors',
        canActivate: [PermissionGuard],
        loadComponent: () =>
          import('./features/investors/investor.component').then(
            (m) => m.InvestorComponent
          ),
      },
      // ── Orders Module ────────────────────────────────────────────────
      {
        path: 'orders',
        canActivate: [PermissionGuard],
        loadComponent: () =>
          import('./features/orders/order-list.component').then((m) => m.OrderListComponent),
      },
      {
        path: 'orders/new',
        canActivate: [PermissionGuard],
        loadComponent: () =>
          import('./features/orders/order-entry.component').then((m) => m.OrderEntryComponent),
      },
      // ── Reports Module ──────────────────────────────────────────────
      // Single "Reports" menu entry — Sales Summary / Sales Details /
      // Invoice Report / Profit Report all live as tabs inside one hub page.
      {
        path: 'reports',
        canActivate: [PermissionGuard],
        loadComponent: () =>
          import('./features/reports/reports-hub.component').then(
            (m) => m.ReportsHubComponent
          ),
      },
      // Kept for backward compatibility with any bookmarked/old links.
      {
        path: 'reports/profit',
        canActivate: [PermissionGuard],
        loadComponent: () =>
          import('./features/reports/profit-report.component').then(
            (m) => m.ProfitReportComponent
          ),
      },
      // ── Super Admin (platform operator, not a tenant role) ────────────
      // Not linked from the sidebar — the backend rejects anyone without
      // the SuperAdmin role regardless, reachable directly at this URL.
      // See SaaS_Platform_Architecture.md Section 11.
      {
        path: 'superadmin/tenants',
        loadComponent: () =>
          import('./features/super-admin/tenant-management.component').then(
            (m) => m.TenantManagementComponent
          ),
      },
    ],
  },
  { path: '**', redirectTo: 'dashboard' },
];
