import { Component, OnInit, ChangeDetectorRef } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { TranslocoModule, TranslocoService, provideTranslocoScope } from '@jsverse/transloco';
import {
  UserService,
  UserResponse,
  CreateUserRequest,
  UpdateUserRequest,
  ChangePasswordRequest,
  RoleResponse,
  UserRoleResponse,
  AssignRoleRequest
} from '../../services/user.service';
import { AlertService } from '../../shared/alert.service';

@Component({
  selector: 'app-user-management',
  standalone: true,
  imports: [CommonModule, FormsModule, TranslocoModule],
  // Loads assets/i18n/security/{en,bn}.json only when this route is hit.
  providers: [provideTranslocoScope('security')],
  templateUrl: './user-management.component.html',
  styleUrls: ['./user-management.component.css']
})
export class UserManagementComponent implements OnInit {

  // ── State ──────────────────────────────────────────────────────────────────
  users: UserResponse[]         = [];
  allRoles: RoleResponse[]      = [];
  userRoles: UserRoleResponse[] = [];
  Math = Math;

  isLoading      = false;
  searchTerm     = '';
  filterActive?: boolean = undefined;

  // Forms
  showCreateForm    = false;
  showEditForm      = false;
  showPasswordForm  = false;
  showRoleModal     = false;

  selectedUser: UserResponse | null = null;

  createForm: CreateUserRequest = { userName: '', password: '', role: 'Cashier' };
  editForm: UpdateUserRequest   = { userName: '', role: '', isActive: true };
  passwordForm: ChangePasswordRequest = { oldPassword: '', newPassword: '' };
  isAdminReset = false;

  assignRoleId = 0;
  roleOptions = ['Admin', 'Manager', 'Cashier', 'Viewer'];

  // Pagination & sorting
  pageSize    = 10;
  currentPage = 1;
  sortBy      = 'userName';
  sortOrder: 'asc' | 'desc' = 'asc';

  // Validation
  createErrors = { userName: '', password: '' };
  editErrors   = { userName: '' };
  passwordErrors = { oldPassword: '', newPassword: '' };

  constructor(
    private userService: UserService,
    private alertService: AlertService,
    private cdr: ChangeDetectorRef,
    private transloco: TranslocoService
  ) {}

  /** Shorthand for the 'security' scope — see provideTranslocoScope above. */
  private t(key: string, params?: Record<string, unknown>): string {
    return this.transloco.translate(`security.${key}`, params);
  }

  ngOnInit(): void {
    this.loadUsers();
    this.loadRoles();
  }

  // ── Load ───────────────────────────────────────────────────────────────────

  loadUsers(): void {
    this.isLoading = true;
    this.userService.getUsers(this.filterActive, this.searchTerm || undefined).subscribe({
      next: (data) => { this.users = data; this.isLoading = false; this.currentPage = 1; this.cdr.detectChanges(); },
      error: () => { this.alertService.error(this.t('users.messages.loadError'), this.t('users.messages.error')); this.isLoading = false; }
    });
  }

  loadRoles(): void {
    this.userService.getRoles(true).subscribe({
      next: (data) => { this.allRoles = data; },
      error: () => {}
    });
  }

  loadUserRoles(userId: number): void {
    this.userService.getUserRoles(userId).subscribe({
      next: (data) => { this.userRoles = data; this.cdr.detectChanges(); },
      error: () => { this.userRoles = []; }
    });
  }

  // ── Validation ─────────────────────────────────────────────────────────────

  validateCreateField(field: string): void {
    const val = (this.createForm as any)[field]?.toString().trim() || '';
    (this.createErrors as any)[field] = '';
    if (field === 'userName' && !val) this.createErrors.userName = this.t('users.messages.usernameRequired');
    if (field === 'password' && !val) this.createErrors.password = this.t('users.messages.passwordRequired');
  }

  validateEditField(field: string): void {
    const val = (this.editForm as any)[field]?.toString().trim() || '';
    (this.editErrors as any)[field] = '';
    if (field === 'userName' && !val) this.editErrors.userName = this.t('users.messages.usernameRequired');
  }

  validatePasswordField(field: string): void {
    const val = (this.passwordForm as any)[field]?.toString().trim() || '';
    (this.passwordErrors as any)[field] = '';
    if (field === 'newPassword' && !val) this.passwordErrors.newPassword = this.t('users.messages.newPasswordRequired');
    if (field === 'oldPassword' && !this.isAdminReset && !val) this.passwordErrors.oldPassword = this.t('users.messages.currentPasswordRequired');
  }

  isCreateInvalid(f: string): boolean { return !!(this.createErrors as any)[f]; }
  isEditInvalid(f: string): boolean   { return !!(this.editErrors as any)[f]; }
  isPasswordInvalid(f: string): boolean { return !!(this.passwordErrors as any)[f]; }

  // ── Create User ────────────────────────────────────────────────────────────

  openCreateForm(): void {
    this.createForm  = { userName: '', password: '', role: 'Cashier' };
    this.createErrors = { userName: '', password: '' };
    this.showCreateForm = true;
  }

  submitCreate(): void {
    this.validateCreateField('userName');
    this.validateCreateField('password');
    if (this.isCreateInvalid('userName') || this.isCreateInvalid('password')) return;

    this.alertService.confirm(this.t('users.messages.createConfirm', { name: this.createForm.userName })).then((ok: boolean) => {
      if (!ok) return;
      this.userService.createUser(this.createForm).subscribe({
        next: () => {
          this.alertService.success(this.t('users.messages.createSuccess'), this.t('users.messages.success'));
          this.openCreateForm();
          this.loadUsers();
        },
        error: (err) => {
          this.alertService.error(err?.error?.message || this.t('users.messages.createError'), this.t('users.messages.error'));
        }
      });
    });
  }

  // ── Edit User ──────────────────────────────────────────────────────────────

  openEditForm(user: UserResponse): void {
    this.selectedUser = user;
    this.editForm     = { userName: user.userName, role: user.role, isActive: user.isActive };
    this.editErrors   = { userName: '' };
    this.showEditForm = true;
  }

  submitEdit(): void {
    if (!this.selectedUser) return;
    this.validateEditField('userName');
    if (this.isEditInvalid('userName')) return;

    this.alertService.confirm(this.t('users.messages.updateConfirm', { name: this.selectedUser.userName })).then((ok: boolean) => {
      if (!ok) return;
      this.userService.updateUser(this.selectedUser!.userId, this.editForm).subscribe({
        next: () => {
          this.alertService.success(this.t('users.messages.updateSuccess'), this.t('users.messages.success'));
          this.showEditForm = false;
          this.loadUsers();
        },
        error: (err) => {
          this.alertService.error(err?.error?.message || this.t('users.messages.updateError'), this.t('users.messages.error'));
        }
      });
    });
  }

  // ── Change Password ────────────────────────────────────────────────────────

  openPasswordForm(user: UserResponse, adminReset = false): void {
    this.selectedUser    = user;
    this.isAdminReset    = adminReset;
    this.passwordForm    = { oldPassword: '', newPassword: '' };
    this.passwordErrors  = { oldPassword: '', newPassword: '' };
    this.showPasswordForm = true;
  }

  submitPasswordChange(): void {
    if (!this.selectedUser) return;
    this.validatePasswordField('newPassword');
    if (!this.isAdminReset) this.validatePasswordField('oldPassword');
    if (this.isPasswordInvalid('newPassword') || this.isPasswordInvalid('oldPassword')) return;

    this.alertService.confirm(this.t('users.messages.passwordConfirm', { name: this.selectedUser.userName })).then((ok: boolean) => {
      if (!ok) return;
      const dto: ChangePasswordRequest = {
        oldPassword: this.isAdminReset ? undefined : (this.passwordForm.oldPassword || undefined),
        newPassword: this.passwordForm.newPassword
      };
      this.userService.changePassword(this.selectedUser!.userId, dto).subscribe({
        next: () => {
          this.alertService.success(this.t('users.messages.passwordSuccess'), this.t('users.messages.success'));
          this.showPasswordForm = false;
        },
        error: (err) => {
          this.alertService.error(err?.error?.message || this.t('users.messages.passwordError'), this.t('users.messages.error'));
        }
      });
    });
  }

  // ── Role Assignment ────────────────────────────────────────────────────────

  openRoleModal(user: UserResponse): void {
    this.selectedUser  = user;
    this.assignRoleId  = 0;
    this.loadUserRoles(user.userId);
    this.showRoleModal = true;
  }

  submitAssignRole(): void {
    if (!this.selectedUser || !this.assignRoleId) {
      this.alertService.warning(this.t('users.messages.selectRoleWarning'), this.t('users.messages.validation'));
      return;
    }
    const dto: AssignRoleRequest = { userId: this.selectedUser.userId, roleId: this.assignRoleId };
    this.userService.assignRole(dto).subscribe({
      next: () => {
        this.alertService.success(this.t('users.messages.roleAssignedSuccess'), this.t('users.messages.success'));
        this.loadUserRoles(this.selectedUser!.userId);
        this.loadUsers();
        this.assignRoleId = 0;
      },
      error: (err) => {
        this.alertService.error(err?.error?.message || this.t('users.messages.roleAssignError'), this.t('users.messages.error'));
      }
    });
  }

  removeRole(userRoleId: number, userId: number, roleId: number): void {
    this.alertService.confirm(this.t('users.messages.removeRoleConfirm')).then((ok: boolean) => {
      if (!ok) return;
      this.userService.removeRole(userId, roleId).subscribe({
        next: () => {
          this.alertService.success(this.t('users.messages.roleRemovedSuccess'), this.t('users.messages.success'));
          this.loadUserRoles(userId);
          this.loadUsers();
        },
        error: () => this.alertService.error(this.t('users.messages.roleRemoveError'), this.t('users.messages.error'))
      });
    });
  }

  // ── Grid helpers ───────────────────────────────────────────────────────────

  setSortColumn(col: string): void {
    if (this.sortBy === col) {
      this.sortOrder = this.sortOrder === 'asc' ? 'desc' : 'asc';
    } else {
      this.sortBy = col;
      this.sortOrder = 'asc';
    }
    this.currentPage = 1;
  }

  getSortIcon(col: string): string {
    if (this.sortBy !== col) return '↕';
    return this.sortOrder === 'asc' ? '↑' : '↓';
  }

  get sortedUsers(): UserResponse[] {
    return [...this.users].sort((a, b) => {
      let av = (a as any)[this.sortBy] ?? '';
      let bv = (b as any)[this.sortBy] ?? '';
      if (typeof av === 'string') { av = av.toLowerCase(); bv = bv.toLowerCase(); }
      const cmp = av < bv ? -1 : av > bv ? 1 : 0;
      return this.sortOrder === 'asc' ? cmp : -cmp;
    });
  }

  get paginatedUsers(): UserResponse[] {
    const start = (this.currentPage - 1) * this.pageSize;
    return this.sortedUsers.slice(start, start + this.pageSize);
  }

  get totalPages(): number {
    return Math.ceil(this.users.length / this.pageSize);
  }

  nextPage(): void { if (this.currentPage < this.totalPages) this.currentPage++; }
  prevPage(): void { if (this.currentPage > 1) this.currentPage--; }
  goToPage(p: number): void { if (p >= 1 && p <= this.totalPages) this.currentPage = p; }

  // ── Misc ───────────────────────────────────────────────────────────────────

  onSearch(): void { this.loadUsers(); }
  onFilterChange(): void { this.loadUsers(); }

  closeAllModals(): void {
    this.showCreateForm   = false;
    this.showEditForm     = false;
    this.showPasswordForm = false;
    this.showRoleModal    = false;
  }

  get activeCount(): number   { return this.users.filter(u => u.isActive).length; }
  get inactiveCount(): number { return this.users.filter(u => !u.isActive).length; }

  get assignedRoleIds(): number[] { return this.userRoles.map(r => r.roleId); }

  get availableRoles(): RoleResponse[] {
    return this.allRoles.filter(r => !this.assignedRoleIds.includes(r.roleId));
  }
}
