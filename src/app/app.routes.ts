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
      // {
      //   path: 'products',
      //   loadComponent: () =>
      //     import('./features/products/products.component').then((m) => m.ProductsComponent),
      // },
      // {
      //   path: 'customers',
      //   loadComponent: () =>
      //     import('./features/customers/customers.component').then((m) => m.CustomersComponent),
      // },
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
