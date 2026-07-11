import { Component, OnInit, ChangeDetectorRef } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { InvestorService, Investor } from '../../services/investor.service';
import { AlertService } from '../../shared/alert.service';
import { toLocalDateString } from '../../shared/date-utils';

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

  readonly emptyForm = {
    investorName: '',
    phone: '',

    // KYC
    nid: '',
    fatherName: '',
    motherName: '',
    presentAddress: '',
    permanentAddress: '',
    occupation: '',
    nationality: '',
    dateOfBirth: '',

    // Shareholding / investment
    sharePercentage: null as number | null,
    numberOfShares: null as number | null,
    shareValue: null as number | null,
    investmentAmount: null as number | null,
    joiningDate: toLocalDateString(),
    leavingDate: '',
    isDirector: false,
  };

  form = { ...this.emptyForm };
  validationErrors: Record<string, string> = {};

  get filteredInvestors(): Investor[] {
    const q = this.searchText.trim().toLowerCase();
    if (!q) return this.investors;
    return this.investors.filter(i =>
      i.investorName.toLowerCase().includes(q) ||
      (i.phone || '').includes(q) ||
      (i.nid || '').includes(q)
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

    const share = this.form.sharePercentage;
    if (share === null || share === undefined || +share <= 0 || +share > 100)
      this.validationErrors['sharePercentage'] = 'Share percentage is required and must be between 0 and 100';

    if (this.form.nid && !/^[0-9A-Za-z-]{5,30}$/.test(this.form.nid.trim()))
      this.validationErrors['nid'] = 'Enter a valid NID number';

    if (this.form.leavingDate && this.form.joiningDate && this.form.leavingDate < this.form.joiningDate)
      this.validationErrors['leavingDate'] = 'Leaving date cannot be before joining date';

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
      phone: this.form.phone || undefined,

      nid: this.form.nid?.trim() || undefined,
      fatherName: this.form.fatherName?.trim() || undefined,
      motherName: this.form.motherName?.trim() || undefined,
      presentAddress: this.form.presentAddress?.trim() || undefined,
      permanentAddress: this.form.permanentAddress?.trim() || undefined,
      occupation: this.form.occupation?.trim() || undefined,
      nationality: this.form.nationality?.trim() || undefined,
      dateOfBirth: this.form.dateOfBirth || undefined,

      sharePercentage: +this.form.sharePercentage!,
      numberOfShares: this.form.numberOfShares ?? undefined,
      shareValue: this.form.shareValue ?? undefined,
      investmentAmount: this.form.investmentAmount ?? undefined,
      joiningDate: this.form.joiningDate || undefined,
      leavingDate: this.form.leavingDate || undefined,
      isDirector: this.form.isDirector,
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

  /** Same present-address value copied into permanent address ("same as present") */
  copyPresentToPermanent(): void {
    this.form.permanentAddress = this.form.presentAddress;
  }

  resetForm(): void {
    this.form = { ...this.emptyForm, joiningDate: toLocalDateString() };
    this.validationErrors = {};
  }
}
