import { Component, OnInit, ChangeDetectorRef } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { TranslocoModule, TranslocoService, provideTranslocoScope } from '@jsverse/transloco';
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
  imports: [CommonModule, FormsModule, TranslocoModule],
  // Loads assets/i18n/security/{en,bn}.json only when this route is hit.
  providers: [provideTranslocoScope('security')],
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
      if (!val) this.validationErrors.roleCode = this.t('roles.messages.codeRequired');
      else if (val.length > 20) this.validationErrors.roleCode = this.t('roles.messages.codeMaxLength');
    }
    if (field === 'roleName') {
      if (!val) this.validationErrors.roleName = this.t('roles.messages.nameRequired');
      else if (val.length > 100) this.validationErrors.roleName = this.t('roles.messages.nameMaxLength');
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
    private cdr: ChangeDetectorRef,
    private transloco: TranslocoService
  ) {}

  /** Shorthand for the 'security' scope — see provideTranslocoScope above. */
  private t(key: string, params?: Record<string, unknown>): string {
    return this.transloco.translate(`security.${key}`, params);
  }

  ngOnInit(): void { this.loadRoles(); }

  loadRoles(): void {
    this.isLoading = true;
    this.userService.getRoles().subscribe({
      next: (data) => { this.roles = data; this.isLoading = false; this.cdr.detectChanges(); },
      error: () => { this.alertService.error(this.t('roles.messages.loadError'), this.t('roles.messages.error')); this.isLoading = false; }
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
      ? this.t('roles.messages.updateConfirm', { name: this.form.roleName })
      : this.t('roles.messages.createConfirm', { name: this.form.roleName });

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
            this.alertService.success(this.t('roles.messages.updateSuccess'), this.t('roles.messages.success'));
            this.openCreateForm();
            this.loadRoles();
          },
          error: (err) => {
            this.alertService.error(err?.error?.message || this.t('roles.messages.updateError'), this.t('roles.messages.error'));
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
            this.alertService.success(this.t('roles.messages.createSuccess'), this.t('roles.messages.success'));
            this.openCreateForm();
            this.loadRoles();
          },
          error: (err) => {
            this.alertService.error(err?.error?.message || this.t('roles.messages.createError'), this.t('roles.messages.error'));
          }
        });
      }
    });
  }

  searchText = '';
  statusFilter = '';   // '' | 'active' | 'inactive'

  get filteredRoles(): RoleResponse[] {
    const q = this.searchText.toLowerCase().trim();
    return this.roles.filter(r => {
      const matchesSearch = !q ||
        (r.roleCode   || '').toLowerCase().includes(q) ||
        (r.roleName   || '').toLowerCase().includes(q) ||
        (r.description|| '').toLowerCase().includes(q);
      const matchesStatus =
        this.statusFilter === '' ||
        (this.statusFilter === 'active'   &&  r.isActive) ||
        (this.statusFilter === 'inactive' && !r.isActive);
      return matchesSearch && matchesStatus;
    });
  }

  get activeCount(): number   { return this.roles.filter(r => r.isActive).length; }
  get inactiveCount(): number { return this.roles.filter(r => !r.isActive).length; }
}
