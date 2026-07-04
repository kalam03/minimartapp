import { Component, OnInit, ChangeDetectorRef } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { InvestorService, Investor } from '../../services/investor.service';
import { AlertService } from '../../shared/alert.service';

@Component({
  selector: 'app-investor',
  standalone: true,
  imports: [CommonModule, FormsModule],
  templateUrl: './investor.component.html',
  styleUrls: ['./investor.component.css']
})
export class InvestorComponent implements OnInit {
  investors: Investor[] = [];
  isSaving = false;
  searchText = '';

  form = {
    investorName: '',
    phone: ''
  };
  validationErrors: Record<string, string> = {};

  get filteredInvestors(): Investor[] {
    const q = this.searchText.trim().toLowerCase();
    if (!q) return this.investors;
    return this.investors.filter(i =>
      i.investorName.toLowerCase().includes(q) ||
      (i.phone || '').includes(q)
    );
  }

  constructor(
    private investorService: InvestorService,
    private alertService: AlertService,
    private cdr: ChangeDetectorRef
  ) {}

  ngOnInit(): void {
    this.loadInvestors();
  }

  loadInvestors(): void {
    this.investorService.getAllInvestors().subscribe({
      next: (res) => {
        this.investors = res.data || [];
        this.cdr.detectChanges();
      },
      error: (err: any) => {
        this.alertService.error('Failed to load investors: ' + (err.error?.message || err.message));
      }
    });
  }

  validateForm(): boolean {
    this.validationErrors = {};
    if (!this.form.investorName.trim())
      this.validationErrors['investorName'] = 'Investor name is required';
    return Object.keys(this.validationErrors).length === 0;
  }

  isFieldInvalid(field: string): boolean {
    return !!this.validationErrors[field];
  }

  saveInvestor(): void {
    if (!this.validateForm()) return;

    this.isSaving = true;
    this.investorService.createInvestor({
      investorName: this.form.investorName.trim(),
      phone: this.form.phone || undefined
    }).subscribe({
      next: (res) => {
        this.isSaving = false;
        this.alertService.success(res.message || 'Investor added successfully!');
        this.resetForm();
        this.loadInvestors();
      },
      error: (err: any) => {
        this.isSaving = false;
        this.alertService.error('Failed to add investor: ' + (err.error?.message || err.message));
      }
    });
  }

  resetForm(): void {
    this.form = { investorName: '', phone: '' };
    this.validationErrors = {};
  }
}
