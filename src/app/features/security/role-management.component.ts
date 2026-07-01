import { Component, OnInit, ChangeDetectorRef } from '@angular/core';
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

  validationErrors = {
    roleCode: '',
    roleName: '',
    description: ''
  };

  validateField(field: string): void {
    const val = (this.form as any)[field]?.toString().trim() || '';
    this.validationErrors[field as keyof typeof this.validationErrors] = '';
    if (field === 'roleCode') {
      if (!val) this.validationErrors.roleCode = 'Role code is required';
      else if (val.length > 20) this.validationErrors.roleCode = 'Max 20 characters';
    }
    if (field === 'roleName') {
      if (!val) this.validationErrors.roleName = 'Role name is required';
      else if (val.length > 100) this.validationErrors.roleName = 'Max 100 characters';
    }
  }

  isFieldInvalid(field: string): boolean {
    return !!this.validationErrors[field as keyof typeof this.validationErrors];
  }

  clearValidationErrors(): void {
    this.validationErrors = { roleCode: '', roleName: '', description: '' };
  }

  constructor(
    private userService: UserService,
    private alertService: AlertService,
    private cdr: ChangeDetectorRef
  ) {}

  ngOnInit(): void { this.loadRoles(); }

  loadRoles(): void {
    this.isLoading = true;
    this.userService.getRoles().subscribe({
      next: (data) => { this.roles = data; this.isLoading = false; this.cdr.detectChanges(); },
      error: () => { this.alertService.error('Failed to load roles.', 'Error'); this.isLoading = false; }
    });
  }

  openCreateForm(): void {
    this.editingId = null;
    this.form = { roleCode: '', roleName: '', description: '', isActive: true };
    this.clearValidationErrors();
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
    this.clearValidationErrors();
    this.showForm = true;
  }

  submitForm(): void {
    this.validateField('roleCode');
    this.validateField('roleName');
    if (this.isFieldInvalid('roleCode') || this.isFieldInvalid('roleName')) {
      return;
    }

    const msg = this.editingId
      ? `Are you sure you want to update role "${this.form.roleName}"?`
      : `Are you sure you want to create role "${this.form.roleName}"?`;

    this.alertService.confirm(msg).then((confirmed: boolean) => {
      if (!confirmed) return;

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
            this.openCreateForm();
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
            this.openCreateForm();
            this.loadRoles();
          },
          error: (err) => {
            this.alertService.error(err?.error?.message || 'Failed to create role.', 'Error');
          }
        });
      }
    });
  }

  get activeCount(): number   { return this.roles.filter(r => r.isActive).length; }
  get inactiveCount(): number { return this.roles.filter(r => !r.isActive).length; }
}
