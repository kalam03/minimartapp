import { Component, OnInit, ChangeDetectorRef } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { TranslocoModule, TranslocoService, provideTranslocoScope } from '@jsverse/transloco';
import {
  PermissionService,
  UserPermissionRow,
  UserListItem,
  SavePermissionsRequest
} from '../../services/permission.service';
import { AlertService } from '../../shared/alert.service';

interface ModuleGroup {
  moduleId:   string;
  moduleName: string;
  rows:       UserPermissionRow[];
  allView:    boolean;
  allAdd:     boolean;
  allEdit:    boolean;
  allDel:     boolean;
  allAuth:    boolean;
  allProcess: boolean;
  allRptView: boolean;
  allRptPrint:boolean;
}

@Component({
  selector: 'app-user-permission',
  standalone: true,
  imports: [CommonModule, FormsModule, TranslocoModule],
  // Loads assets/i18n/security/{en,bn}.json only when this route is hit.
  providers: [provideTranslocoScope('security')],
  templateUrl: './user-permission.component.html'
})
export class UserPermissionComponent implements OnInit {

  users:    UserListItem[]  = [];
  modules:  ModuleGroup[]   = [];
  allRows:  UserPermissionRow[] = [];

  selectedUserId: number | null = null;
  selectedUser:   UserListItem | null = null;

  loading    = false;
  saving     = false;
  hasChanges = false;

  // Permission column definitions (label + key)
  readonly cols = [
    { key: 'allowMaintView',   label: 'View'  },
    { key: 'allowMaintAdd',    label: 'Add'   },
    { key: 'allowMaintEdit',   label: 'Edit'  },
    { key: 'allowMaintDel',    label: 'Delete'},
    { key: 'allowMaintAuth',   label: 'Auth'  },
    { key: 'allowProcess',     label: 'Process'},
    { key: 'allowReportView',  label: 'Rpt View' },
    { key: 'allowReportPrint', label: 'Rpt Print'},
    { key: 'allowReportGen',   label: 'Rpt Gen'  },
  ] as const;

  constructor(
    private permSvc:   PermissionService,
    private alertSvc:  AlertService,
    private cdr:       ChangeDetectorRef,
    private transloco: TranslocoService
  ) {}

  /** Shorthand for the 'security' scope — see provideTranslocoScope above. */
  private t(key: string, params?: Record<string, unknown>): string {
    return this.transloco.translate(`security.${key}`, params);
  }

  ngOnInit(): void {
    this.loadUsers();
  }

  loadUsers(): void {
    this.permSvc.getUsers().subscribe({
      next: res => {
        this.users = res?.data ?? [];
        this.cdr.detectChanges();
      },
      error: () => this.alertSvc.error(this.t('permissions.messages.loadUsersError'))
    });
  }

  onUserChange(): void {
    if (!this.selectedUserId) { this.modules = []; return; }
    this.selectedUser = this.users.find(u => u.userId == this.selectedUserId) ?? null;
    this.loadPermissions();
  }

  loadPermissions(): void {
    if (!this.selectedUserId) return;
    this.loading = true;
    this.permSvc.getUserPermissions(+this.selectedUserId).subscribe({
      next: res => {
        this.allRows = res?.data ?? [];
        this.buildModules();
        this.loading = false;
        this.hasChanges = false;
        this.cdr.detectChanges();
      },
      error: () => {
        this.loading = false;
        this.alertSvc.error(this.t('permissions.messages.loadPermissionsError'));
      }
    });
  }

  private buildModules(): void {
    const map = new Map<string, ModuleGroup>();
    for (const row of this.allRows) {
      if (!map.has(row.moduleId)) {
        map.set(row.moduleId, {
          moduleId:    row.moduleId,
          moduleName:  row.moduleName,
          rows:        [],
          allView: false, allAdd: false, allEdit: false, allDel: false,
          allAuth: false, allProcess: false, allRptView: false, allRptPrint: false
        });
      }
      map.get(row.moduleId)!.rows.push(row);
    }
    this.modules = Array.from(map.values());
    this.modules.forEach(m => this.refreshModuleHeader(m));
  }

  // ── Toggle single flag ─────────────────────────────────────────
  toggle(row: UserPermissionRow, col: string): void {
    (row as any)[col] = !(row as any)[col];
    // View is a prereq: if any perm is granted, auto-enable View
    if (col !== 'allowMaintView' && (row as any)[col]) {
      row.allowMaintView = true;
    }
    // If View unchecked, revoke all other perms
    if (col === 'allowMaintView' && !row.allowMaintView) {
      row.allowMaintAdd = row.allowMaintEdit = row.allowMaintDel =
      row.allowMaintAuth = row.allowProcess =
      row.allowReportView = row.allowReportPrint = row.allowReportGen = false;
    }
    this.hasChanges = true;
    const mod = this.modules.find(m => m.moduleId === row.moduleId);
    if (mod) this.refreshModuleHeader(mod);
  }

  // ── Toggle entire column in a module ──────────────────────────
  toggleModuleColumn(mod: ModuleGroup, col: keyof ModuleGroup): void {
    const newVal = !mod[col];
    (mod as any)[col] = newVal;
    for (const row of mod.rows) {
      (row as any)[this.moduleColToRowKey(col as string)] = newVal;
      if (newVal && this.moduleColToRowKey(col as string) !== 'allowMaintView') {
        row.allowMaintView = true;
      }
      if (!newVal && col === 'allView') {
        row.allowMaintAdd = row.allowMaintEdit = row.allowMaintDel =
        row.allowMaintAuth = row.allowProcess =
        row.allowReportView = row.allowReportPrint = row.allowReportGen = false;
      }
    }
    this.refreshModuleHeader(mod);
    this.hasChanges = true;
  }

  // ── Grant / Revoke all for a module ───────────────────────────
  grantAllModule(mod: ModuleGroup): void {
    for (const row of mod.rows) {
      row.allowMaintView = row.allowMaintAdd = row.allowMaintEdit =
      row.allowMaintDel  = row.allowMaintAuth = row.allowProcess =
      row.allowReportView = row.allowReportPrint = row.allowReportGen = true;
    }
    this.refreshModuleHeader(mod);
    this.hasChanges = true;
  }

  revokeAllModule(mod: ModuleGroup): void {
    for (const row of mod.rows) {
      row.allowMaintView = row.allowMaintAdd = row.allowMaintEdit =
      row.allowMaintDel  = row.allowMaintAuth = row.allowProcess =
      row.allowReportView = row.allowReportPrint = row.allowReportGen = false;
    }
    this.refreshModuleHeader(mod);
    this.hasChanges = true;
  }

  // ── Refresh the "all column" checkboxes in the module header ──
  private refreshModuleHeader(mod: ModuleGroup): void {
    const r = mod.rows;
    mod.allView     = r.every(x => x.allowMaintView);
    mod.allAdd      = r.every(x => x.allowMaintAdd);
    mod.allEdit     = r.every(x => x.allowMaintEdit);
    mod.allDel      = r.every(x => x.allowMaintDel);
    mod.allAuth     = r.every(x => x.allowMaintAuth);
    mod.allProcess  = r.every(x => x.allowProcess);
    mod.allRptView  = r.every(x => x.allowReportView);
    mod.allRptPrint = r.every(x => x.allowReportPrint);
  }

  private moduleColToRowKey(col: string): string {
    const map: Record<string,string> = {
      allView:'allowMaintView', allAdd:'allowMaintAdd', allEdit:'allowMaintEdit',
      allDel:'allowMaintDel', allAuth:'allowMaintAuth', allProcess:'allowProcess',
      allRptView:'allowReportView', allRptPrint:'allowReportPrint', allRptGen:'allowReportGen'
    };
    return map[col] ?? col;
  }

  // ── Save ───────────────────────────────────────────────────────
  async save(): Promise<void> {
    if (!this.selectedUserId) return;
    this.saving = true;

    const request: SavePermissionsRequest = {
      userId: +this.selectedUserId,
      permissions: this.allRows.map(r => ({
        functionId:        r.functionId,
        allowMaintAdd:     r.allowMaintAdd,
        allowMaintEdit:    r.allowMaintEdit,
        allowMaintDel:     r.allowMaintDel,
        allowMaintView:    r.allowMaintView,
        allowMaintAuth:    r.allowMaintAuth,
        allowProcess:      r.allowProcess,
        allowReportView:   r.allowReportView,
        allowReportPrint:  r.allowReportPrint,
        allowReportGen:    r.allowReportGen,
        allowAnyOfficeOps: r.allowAnyOfficeOps
      }))
    };

    this.permSvc.savePermissions(request).subscribe({
      next: res => {
        this.saving = false;
        this.hasChanges = false;
        this.alertSvc.success(res.message ?? this.t('permissions.messages.saveSuccess'));
        this.cdr.detectChanges();
      },
      error: err => {
        this.saving = false;
        this.alertSvc.error(this.t('permissions.messages.saveError', { error: err.error?.message ?? err.message }));
      }
    });
  }

  // ── Track row col value ────────────────────────────────────────
  getFlag(row: UserPermissionRow, key: string): boolean {
    return !!(row as any)[key];
  }
}
