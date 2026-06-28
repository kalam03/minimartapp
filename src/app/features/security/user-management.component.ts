import { Component, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
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
  imports: [CommonModule, FormsModule],
  templateUrl: './user-management.component.html',
  styleUrls: ['./user-management.component.css']
})
export class UserManagementComponent implements OnInit {

  // ── State ──────────────────────────────────────────────────────────────────
  users: UserResponse[]       = [];
  allRoles: RoleResponse[]    = [];
  userRoles: UserRoleResponse[] = [];

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

  constructor(
    private userService: UserService,
    private alertService: AlertService
  ) {}

  ngOnInit(): void {
    this.loadUsers();
    this.loadRoles();
  }

  // ── Load ───────────────────────────────────────────────────────────────────

  loadUsers(): void {
    this.isLoading = true;
    this.userService.getUsers(this.filterActive, this.searchTerm || undefined).subscribe({
      next: (data) => { this.users = data; this.isLoading = false; },
      error: () => { this.alertService.error('Failed to load users', 'Error'); this.isLoading = false; }
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
      next: (data) => { this.userRoles = data; },
      error: () => { this.userRoles = []; }
    });
  }

  // ── Create User ────────────────────────────────────────────────────────────

  openCreateForm(): void {
    this.createForm = { userName: '', password: '', role: 'Cashier' };
    this.showCreateForm = true;
  }

  submitCreate(): void {
    if (!this.createForm.userName || !this.createForm.password) {
      this.alertService.warning('Username and password are required.', 'Validation');
      return;
    }
    this.userService.createUser(this.createForm).subscribe({
      next: () => {
        this.alertService.success('User created successfully.', 'Success');
        this.showCreateForm = false;
        this.loadUsers();
      },
      error: (err) => {
        const msg = err?.error?.message || 'Failed to create user.';
        this.alertService.error(msg, 'Error');
      }
    });
  }

  // ── Edit User ──────────────────────────────────────────────────────────────

  openEditForm(user: UserResponse): void {
    this.selectedUser = user;
    this.editForm = { userName: user.userName, role: user.role, isActive: user.isActive };
    this.showEditForm = true;
  }

  submitEdit(): void {
    if (!this.selectedUser) return;
    this.userService.updateUser(this.selectedUser.userId, this.editForm).subscribe({
      next: () => {
        this.alertService.success('User updated successfully.', 'Success');
        this.showEditForm = false;
        this.loadUsers();
      },
      error: (err) => {
        const msg = err?.error?.message || 'Failed to update user.';
        this.alertService.error(msg, 'Error');
      }
    });
  }

  // ── Change Password ────────────────────────────────────────────────────────

  openPasswordForm(user: UserResponse, adminReset = false): void {
    this.selectedUser  = user;
    this.isAdminReset  = adminReset;
    this.passwordForm  = { oldPassword: '', newPassword: '' };
    this.showPasswordForm = true;
  }

  submitPasswordChange(): void {
    if (!this.selectedUser) return;
    if (!this.passwordForm.newPassword) {
      this.alertService.warning('New password is required.', 'Validation');
      return;
    }
    const dto: ChangePasswordRequest = {
      oldPassword: this.isAdminReset ? undefined : (this.passwordForm.oldPassword || undefined),
      newPassword: this.passwordForm.newPassword
    };
    this.userService.changePassword(this.selectedUser.userId, dto).subscribe({
      next: () => {
        this.alertService.success('Password changed successfully.', 'Success');
        this.showPasswordForm = false;
      },
      error: (err) => {
        const msg = err?.error?.message || 'Failed to change password.';
        this.alertService.error(msg, 'Error');
      }
    });
  }

  // ── Role Assignment ────────────────────────────────────────────────────────

  openRoleModal(user: UserResponse): void {
    this.selectedUser = user;
    this.assignRoleId = 0;
    this.loadUserRoles(user.userId);
    this.showRoleModal = true;
  }

  submitAssignRole(): void {
    if (!this.selectedUser || !this.assignRoleId) {
      this.alertService.warning('Please select a role.', 'Validation');
      return;
    }
    const dto: AssignRoleRequest = { userId: this.selectedUser.userId, roleId: this.assignRoleId };
    this.userService.assignRole(dto).subscribe({
      next: () => {
        this.alertService.success('Role assigned.', 'Success');
        this.loadUserRoles(this.selectedUser!.userId);
        this.loadUsers();
        this.assignRoleId = 0;
      },
      error: (err) => {
        const msg = err?.error?.message || 'Failed to assign role.';
        this.alertService.error(msg, 'Error');
      }
    });
  }

  removeRole(userRoleId: number, userId: number, roleId: number): void {
    this.userService.removeRole(userId, roleId).subscribe({
      next: () => {
        this.alertService.success('Role removed.', 'Success');
        this.loadUserRoles(userId);
        this.loadUsers();
      },
      error: () => this.alertService.error('Failed to remove role.', 'Error')
    });
  }

  // ── Helpers ────────────────────────────────────────────────────────────────

  onSearch(): void { this.loadUsers(); }

  onFilterChange(): void { this.loadUsers(); }

  closeAllModals(): void {
    this.showCreateForm   = false;
    this.showEditForm     = false;
    this.showPasswordForm = false;
    this.showRoleModal    = false;
  }

  get activeCount(): number  { return this.users.filter(u => u.isActive).length; }
  get inactiveCount(): number { return this.users.filter(u => !u.isActive).length; }

  // Roles already assigned to selected user
  get assignedRoleIds(): number[] {
    return this.userRoles.map(r => r.roleId);
  }

  get availableRoles(): RoleResponse[] {
    return this.allRoles.filter(r => !this.assignedRoleIds.includes(r.roleId));
  }
}
