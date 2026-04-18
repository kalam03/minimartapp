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
    canActivate: [AuthGuard], // Protect all child routes
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
      // {
      //   path: 'reports',
      //   loadComponent: () =>
      //     import('./features/reports/reports.component').then((m) => m.ReportsComponent),
      // },
      // {
      //   path: 'settings',
      //   loadComponent: () =>
      //     import('./features/settings/settings.component').then((m) => m.SettingsComponent),
      // },
    ],
  },
  { path: '**', redirectTo: 'dashboard' },
];
