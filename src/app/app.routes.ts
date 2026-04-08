import { Routes } from '@angular/router';
import { LayoutComponent } from './layout/layout.component';

export const routes: Routes = [
  {
    path: '',
    component: LayoutComponent,
    children: [
      { path: '', redirectTo: 'dashboard', pathMatch: 'full' },
      {
        path: 'dashboard',
        loadComponent: () =>
          import('./features/dashboard.component').then((m) => m.DashboardComponent),
      },
      {
        path: 'pos',
        loadComponent: () =>
          import('./features/pos-billing/pos-billing').then((m) => m.PosBillingComponent),
      },
      // Add more routes as needed
      //   {
      //     path: 'products',
      //     loadComponent: () =>
      //       import('./pages/products/products.component').then((m) => m.ProductsComponent),
      //   },
      //   {
      //     path: 'orders',
      //     loadComponent: () =>
      //       import('./pages/orders/orders.component').then((m) => m.OrdersComponent),
      //   },
      //   {
      //     path: 'customers',
      //     loadComponent: () =>
      //       import('./pages/customers/customers.component').then((m) => m.CustomersComponent),
      //   },
    ],
  },
  { path: '**', redirectTo: 'dashboard' },
];
