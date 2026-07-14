import { Component, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { TranslocoModule, TranslocoService, provideTranslocoScope } from '@jsverse/transloco';
import { CategoryService, Category } from '../../services/category.service';
import { AlertService } from '../../shared/alert.service';

@Component({
  selector: 'app-category',
  standalone: true,
  imports: [CommonModule, FormsModule, TranslocoModule],
  // Loads assets/i18n/categories/{en,bn}.json only when this route is hit.
  providers: [provideTranslocoScope('categories')],
  templateUrl: './category.component.html',
  styleUrls: ['./category.component.css']
})
export class CategoryComponent implements OnInit {
  categories: Category[] = [];
  isSaving = false;
  searchText = '';

  readonly emptyForm = {
    categoryName: '',
    isActive: true,
  };

  form = { ...this.emptyForm };
  validationErrors: Record<string, string> = {};

  /** Set while editing an existing row; null while adding a new one */
  editingId: number | null = null;

  get filteredCategories(): Category[] {
    const q = this.searchText.trim().toLowerCase();
    if (!q) return this.categories;
    return this.categories.filter(c => c.categoryName.toLowerCase().includes(q));
  }

  constructor(
    private categoryService: CategoryService,
    private alertService: AlertService,
    private transloco: TranslocoService
  ) {}

  /** Shorthand for the 'categories' scope — see provideTranslocoScope above. */
  private t(key: string, params?: Record<string, unknown>): string {
    return this.transloco.translate(`categories.${key}`, params);
  }

  ngOnInit(): void {
    this.loadCategories();
  }

  loadCategories(): void {
    this.categoryService.getAllCategories().subscribe({
      next: (res) => {
        this.categories = res.data || [];
      },
      error: (err: any) => {
        this.alertService.error(this.t('messages.loadError', { error: err.error?.message || err.message }));
      }
    });
  }

  validateForm(): boolean {
    this.validationErrors = {};

    if (!this.form.categoryName.trim())
      this.validationErrors['categoryName'] = this.t('validation.nameRequired');

    const dupe = this.categories.find(c =>
      c.categoryName.toLowerCase() === this.form.categoryName.trim().toLowerCase() &&
      c.categoryId !== this.editingId
    );
    if (dupe) this.validationErrors['categoryName'] = this.t('validation.nameDuplicate');

    return Object.keys(this.validationErrors).length === 0;
  }

  isFieldInvalid(field: string): boolean {
    return !!this.validationErrors[field];
  }

  saveCategory(): void {
    if (!this.validateForm()) return;

    this.isSaving = true;

    if (this.editingId) {
      this.categoryService.updateCategory(this.editingId, {
        categoryName: this.form.categoryName.trim(),
        isActive: this.form.isActive,
      }).subscribe({
        next: (res) => {
          this.isSaving = false;
          this.alertService.success(res.message || this.t('messages.updateSuccess'));
          this.resetForm();
          this.loadCategories();
        },
        error: (err: any) => {
          this.isSaving = false;
          this.alertService.error(this.t('messages.updateError', { error: err.error?.message || err.message }));
        }
      });
      return;
    }

    this.categoryService.createCategory({
      categoryName: this.form.categoryName.trim(),
    }).subscribe({
      next: (res) => {
        this.isSaving = false;
        this.alertService.success(res.message || this.t('messages.createSuccess'));
        this.resetForm();
        this.loadCategories();
      },
      error: (err: any) => {
        this.isSaving = false;
        this.alertService.error(this.t('messages.createError', { error: err.error?.message || err.message }));
      }
    });
  }

  editCategory(c: Category): void {
    this.editingId = c.categoryId;
    this.form = {
      categoryName: c.categoryName,
      isActive: c.isActive,
    };
    this.validationErrors = {};
  }

  async toggleActive(c: Category): Promise<void> {
    const confirmed = await this.alertService.confirm(
      this.t(c.isActive ? 'messages.deactivateConfirm' : 'messages.reactivateConfirm', { name: c.categoryName }),
      this.t(c.isActive ? 'messages.deactivateTitle' : 'messages.reactivateTitle')
    );
    if (!confirmed) return;

    if (c.isActive) {
      this.categoryService.deleteCategory(c.categoryId).subscribe({
        next: () => { this.alertService.success(this.t('messages.deactivateSuccess')); this.loadCategories(); },
        error: (err: any) => this.alertService.error(this.t('messages.actionFailed', { error: err.error?.message || err.message }))
      });
    } else {
      this.categoryService.updateCategory(c.categoryId, {
        categoryName: c.categoryName,
        isActive: true,
      }).subscribe({
        next: () => { this.alertService.success(this.t('messages.reactivateSuccess')); this.loadCategories(); },
        error: (err: any) => this.alertService.error(this.t('messages.actionFailed', { error: err.error?.message || err.message }))
      });
    }
  }

  resetForm(): void {
    this.editingId = null;
    this.form = { ...this.emptyForm };
    this.validationErrors = {};
  }
}
