import { Component, signal, HostListener, OnInit, OnDestroy } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { RouterModule, RouterOutlet } from '@angular/router';
import { Subscription } from 'rxjs';
import { AuthService } from '../services/auth.service';
import { PermissionService, NavItem } from '../services/permission.service';

// Fallback nav items shown for admin or when permission data hasn't loaded yet.
// The DB-driven menu will replace these once loadMyMenus() resolves.
const FALLBACK_NAV: NavItem[] = [
  { path: '/dashboard',           icon: 'M3 12l2-2m0 0l7-7 7 7M5 10v10a1 1 0 001 1h3m10-11l2 2m-2-2v10a1 1 0 01-1 1h-3m-6 0a1 1 0 001-1v-4a1 1 0 011-1h2a1 1 0 011 1v4a1 1 0 001 1m-6 0h6',                                                                                                                                       label: 'Dashboard'   },
  { path: '/suppliers',           icon: 'M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0', label: 'Suppliers'   },
  { path: '/products',            icon: 'M20 7L4 7M20 12L4 12M20 17L4 17M8 3v4m8-4v4',                                                                                                                                                                                                                                                                                       label: 'Products'    },
  { path: '/Purchases',           icon: 'M3 3h2l.4 2M7 13h10l4-8H5.4M7 13L5.4 5M7 13l-2.293 2.293c-.63.63-.184 1.707.707 1.707H17m0 0a2 2 0 100 4 2 2 0 000-4zm-8 2a2 2 0 11-4 0 2 2 0 014 0z',                                                                                                                                                                           label: 'Purchases'   },
  { path: '/pos',                 icon: 'M16 11V7a4 4 0 00-8 0v4M5 9h14l1 12H4L5 9z',                                                                                                                                                                                                                                                                                        label: 'Counter'     },
  { path: '/orders',              icon: 'M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2',                                                                                                                                                                                              label: 'Orders'      },
  { path: '/customers',           icon: 'M12 4.354a4 4 0 110 5.292M15 21H3v-1a6 6 0 0112 0v1zm0 0h6v-1a6 6 0 00-9-5.197M13 7a4 4 0 11-8 0 4 4 0 018 0z',                                                                                                                                                                                                                    label: 'Customers'   },
  { path: '/security/users',      icon: 'M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z',                                                                                                                                                                                                                            label: 'Users'       },
  { path: '/security/roles',      icon: 'M9 12l2 2 4-4m5.618-4.016A11.955 11.955 0 0112 2.944a11.955 11.955 0 01-8.618 3.04A12.02 12.02 0 003 9c0 5.591 3.824 10.29 9 11.622 5.176-1.332 9-6.03 9-11.622 0-1.042-.133-2.052-.382-3.016z',                                                                                                                                    label: 'Roles'       },
  { path: '/security/permissions',icon: 'M15 7a2 2 0 012 2m4 0a6 6 0 01-7.743 5.743L11 17H9v2H7v2H4a1 1 0 01-1-1v-2.586a1 1 0 01.293-.707l5.964-5.964A6 6 0 1121 9z',                                                                                                                                                                                                       label: 'Permissions' },
  { path: '/capital',             icon: 'M12 8c-1.657 0-3 .895-3 2s1.343 2 3 2 3 .895 3 2-1.343 2-3 2m0-8c1.11 0 2.08.402 2.599 1M12 8V7m0 1v8m0 0v1m0-1c-1.11 0-2.08-.402-2.599-1M21 12a9 9 0 11-18 0 9 9 0 0118 0z',                                                                                                                                                    label: 'Capital'     },
  { path: '/writeoffs',           icon: 'M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16',                                                                                                                                                                                                      label: 'Write-Offs'  },
  { path: '/employees',           icon: 'M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0z',                                                                                                                          label: 'Payroll'     },
  { path: '/investors',           icon: 'M9 7h6m0 10v-3m-3 3v-6m-3 6v-1m12-9l-9 9-4-4-6 6',                                                                                                                                                                                                                                                                                    label: 'Investors'   },
  { path: '/reports/profit',      icon: 'M13 7h8m0 0v8m0-8l-8 8-4-4-6 6',                                                                                                                                                                                                                                                                                                       label: 'Profit Report' },
];

@Component({
  selector: 'app-layout',
  standalone: true,
  imports: [CommonModule, FormsModule, RouterModule, RouterOutlet],
  templateUrl: './layout.component.html',
  styleUrls: ['./layout.component.css']
})
export class LayoutComponent implements OnInit, OnDestroy {

  // Sidebar state
  isSidebarOpen      = signal(true);
  isSidebarMinimized = signal(false);
  isMobileMenuOpen   = signal(false);
  isMobile           = signal(false);

  // Dynamic nav — updated by PermissionService
  navItems: NavItem[] = [];

  // Sidebar search
  navSearch = '';

  get filteredNavItems(): NavItem[] {
    const q = this.navSearch.trim().toLowerCase();
    if (!q) return this.navItems;
    return this.navItems.filter(i => i.label.toLowerCase().includes(q));
  }

  // Quick actions (static)
  quickActions = [
    { icon: 'M12 4v16m8-8H4',                                                                                                           label: 'New Order'   },
    { icon: 'M20 7L4 7M20 12L4 12M20 17L4 17M8 3v4m8-4v4',                                                                             label: 'Add Product' },
    { icon: 'M12 4.354a4 4 0 110 5.292M15 21H3v-1a6 6 0 0112 0v1zm0 0h6v-1a6 6 0 00-9-5.197M13 7a4 4 0 11-8 0 4 4 0 018 0z',         label: 'New Customer'},
  ];

  private navSub?: Subscription;

  get user() {
    const u = this.authService.getUser();
    const name = u?.userName ?? 'User';
    return {
      name,
      email: u?.role ?? '',
      avatar: `https://ui-avatars.com/api/?name=${encodeURIComponent(name)}&background=6366f1&color=fff`
    };
  }

  constructor(
    private authService: AuthService,
    private permSvc: PermissionService
  ) {
    this.checkScreenSize();
  }

  ngOnInit(): void {
    this.navSub = this.permSvc.navItems$.subscribe(items => {
      if (items && items.length > 0) {
        // DB-driven menu — always show Dashboard first if not included
        const hasDashboard = items.some(i => i.path === '/dashboard' || i.path === 'dashboard');
        this.navItems = hasDashboard
          ? items
          : [FALLBACK_NAV[0], ...items];
      } else if (this.authService.isAdmin()) {
        // Admin or no permissions set yet — use fallback full menu
        this.navItems = FALLBACK_NAV;
      } else {
        // Waiting for API response — show only dashboard
        this.navItems = [FALLBACK_NAV[0]];
      }
    });
  }

  ngOnDestroy(): void {
    this.navSub?.unsubscribe();
  }

  @HostListener('window:resize')
  checkScreenSize(): void {
    const isMobileView = window.innerWidth < 768;
    this.isMobile.set(isMobileView);
    if (isMobileView) {
      this.isSidebarOpen.set(false);
      this.isSidebarMinimized.set(false);
    } else {
      this.isSidebarOpen.set(true);
      this.isSidebarMinimized.set(false);
    }
  }

  toggleSidebar(): void {
    if (this.isMobile()) {
      this.toggleMobileMenu();
    } else {
      if (this.isSidebarOpen()) {
        this.isSidebarMinimized.update(state => !state);
      } else {
        this.isSidebarOpen.set(true);
        this.isSidebarMinimized.set(false);
      }
    }
  }

  toggleMobileMenu(): void {
    this.isMobileMenuOpen.update(state => !state);
    if (this.isMobileMenuOpen()) {
      this.isSidebarOpen.set(true);
      this.isSidebarMinimized.set(false);
    }
  }

  closeMobileMenu(): void {
    this.isMobileMenuOpen.set(false);
    if (this.isMobile()) this.isSidebarOpen.set(false);
  }

  setActiveItem(_index: number): void {
    if (this.isMobile()) this.closeMobileMenu();
  }

  logout(): void {
    this.authService.logout();
  }

  getSidebarWidthClass(): string {
    if (this.isMobile())           return this.isMobileMenuOpen() ? 'w-52' : 'w-0';
    if (this.isSidebarMinimized()) return 'w-14';
    return 'w-52';
  }
}
