import { Component, signal, HostListener } from '@angular/core';
import { CommonModule } from '@angular/common';
import { RouterModule, RouterOutlet } from '@angular/router';
import { AuthService } from '../services/auth.service';

@Component({
  selector: 'app-layout',
  standalone: true,
  imports: [CommonModule, RouterModule, RouterOutlet],
  templateUrl: './layout.component.html',
  styleUrls: ['./layout.component.css']
})
export class LayoutComponent {
  // Sidebar state
  isSidebarOpen     = signal(true);
  isSidebarMinimized = signal(false);
  isMobileMenuOpen  = signal(false);
  isMobile          = signal(false);

  // User data from session
  get user() {
    const u = this.authService.getUser();
    const name = u?.userName ?? 'User';
    return {
      name,
      email: u?.role ?? '',
      avatar: `https://ui-avatars.com/api/?name=${encodeURIComponent(name)}&background=6366f1&color=fff`
    };
  }

  // Navigation items
  navItems = [
    { path: '/dashboard',        icon: 'M3 12l2-2m0 0l7-7 7 7M5 10v10a1 1 0 001 1h3m10-11l2 2m-2-2v10a1 1 0 01-1 1h-3m-6 0a1 1 0 001-1v-4a1 1 0 011-1h2a1 1 0 011 1v4a1 1 0 001 1m-6 0h6', label: 'Dashboard',   active: true  },
    { path: '/suppliers',        icon: 'M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0', label: 'Suppliers',   active: false },
    { path: '/products',         icon: 'M20 7L4 7M20 12L4 12M20 17L4 17M8 3v4m8-4v4',                                                                                                                                      label: 'Products',   active: false },
    { path: '/Purchases',        icon: 'M3 3h2l.4 2M7 13h10l4-8H5.4M7 13L5.4 5M7 13l-2.293 2.293c-.63.63-.184 1.707.707 1.707H17m0 0a2 2 0 100 4 2 2 0 000-4zm-8 2a2 2 0 11-4 0 2 2 0 014 0z',                          label: 'Purchases',  active: false },
    { path: '/pos',              icon: 'M16 11V7a4 4 0 00-8 0v4M5 9h14l1 12H4L5 9z',                                                                                                                                       label: 'Counter',    active: false },
    { path: '/customers',        icon: 'M12 4.354a4 4 0 110 5.292M15 21H3v-1a6 6 0 0112 0v1zm0 0h6v-1a6 6 0 00-9-5.197M13 7a4 4 0 11-8 0 4 4 0 018 0z',                                                                   label: 'Customers',  active: false },
    { path: '/security/users',   icon: 'M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z',                                                                          label: 'Users',      active: false },
    { path: '/security/roles',   icon: 'M9 12l2 2 4-4m5.618-4.016A11.955 11.955 0 0112 2.944a11.955 11.955 0 01-8.618 3.04A12.02 12.02 0 003 9c0 5.591 3.824 10.29 9 11.622 5.176-1.332 9-6.03 9-11.622 0-1.042-.133-2.052-.382-3.016z', label: 'Roles', active: false },
  ];

  // Quick actions
  quickActions = [
    { icon: 'M12 4v16m8-8H4',                                                                                                                                        label: 'New Order'   },
    { icon: 'M20 7L4 7M20 12L4 12M20 17L4 17M8 3v4m8-4v4',                                                                                                         label: 'Add Product' },
    { icon: 'M12 4.354a4 4 0 110 5.292M15 21H3v-1a6 6 0 0112 0v1zm0 0h6v-1a6 6 0 00-9-5.197M13 7a4 4 0 11-8 0 4 4 0 018 0z', label: 'New Customer' }
  ];

  constructor(private authService: AuthService) {
    this.checkScreenSize();
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

  setActiveItem(index: number): void {
    this.navItems.forEach((item, i) => { item.active = i === index; });
    if (this.isMobile()) this.closeMobileMenu();
  }

  logout(): void {
    this.authService.logout();
  }

  getSidebarWidthClass(): string {
    if (this.isMobile())           return this.isMobileMenuOpen() ? 'w-64' : 'w-0';
    if (this.isSidebarMinimized()) return 'w-16';
    return 'w-64';
  }
}
