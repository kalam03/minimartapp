import { Component, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import {
  UserService,
  RoleResponse,
  CreateRoleRequest,
  UpdateRoleRequest
} from '../../services/user.service';
import { AlertService } from '../../shared/alert.service';

@Component({
  selector: 'app-role-management',
  standalone: true,
  imports: [CommonModule, FormsModule],
  templateUrl: './role-management.component.html',
  styleUrls: ['./role-management.component.css']
})
export class RoleManagementComponent implements OnInit {

  roles: RoleResponse[] = [];
  isLoading = false;

  showForm  = false;
  editingId: number | null = null;

  form: CreateRoleRequest & { isActive: boolean } = {
    roleCode:    '',
    roleName:    '',
    description: '',
    isActive:    true
  };

  constructor(
    private userService: UserService,
    private alertService: AlertService
  ) {}

  ngOnInit(): void { this.loadRoles(); }

  loadRoles(): void {
    this.isLoading = true;
    this.userService.getRoles().subscribe({
      next: (data) => { this.roles = data; this.isLoading = false; },
      error: () => { this.alertService.error('Failed to load roles.', 'Error'); this.isLoading = false; }
    });
  }

  openCreateForm(): void {
    this.editingId = null;
    this.form = { roleCode: '', roleName: '', description: '', isActive: true };
    this.showForm = true;
  }

  openEditForm(role: RoleResponse): void {
    this.editingId = role.roleId;
    this.form = {
      roleCode:    role.roleCode,
      roleName:    role.roleName,
      description: role.description || '',
      isActive:    role.isActive
    };
    this.showForm = true;
  }

  submitForm(): void {
    if (!this.form.roleCode || !this.form.roleName) {
      this.alertService.warning('Role Code and Role Name are required.', 'Validation');
      return;
    }

    if (this.editingId) {
      const dto: UpdateRoleRequest = {
        roleCode:    this.form.roleCode,
        roleName:    this.form.roleName,
        description: this.form.description,
        isActive:    this.form.isActive
      };
      this.userService.updateRole(this.editingId, dto).subscribe({
        next: () => {
          this.alertService.success('Role updated.', 'Success');
          this.showForm = false;
          this.loadRoles();
        },
        error: (err) => {
          this.alertService.error(err?.error?.message || 'Failed to update role.', 'Error');
        }
      });
    } else {
      const dto: CreateRoleRequest = {
        roleCode:    this.form.roleCode,
        roleName:    this.form.roleName,
        description: this.form.description
      };
      this.userService.createRole(dto).subscribe({
        next: () => {
          this.alertService.success('Role created.', 'Success');
          this.showForm = false;
          this.loadRoles();
        },
        error: (err) => {
          this.alertService.error(err?.error?.message || 'Failed to create role.', 'Error');
        }
      });
    }
  }

  get activeCount(): number   { return this.roles.filter(r => r.isActive).length; }
  get inactiveCount(): number { return this.roles.filter(r => !r.isActive).length; }
}
