import { Component, OnInit, ChangeDetectorRef } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { SupplierService } from '../../services/supplier.service';
import { AlertService } from '../../shared/alert.service';

@Component({
  selector: 'app-supplier',
  standalone: true,
  imports: [CommonModule, FormsModule],
  templateUrl: './supplier.component.html',
  styleUrls: ['./supplier.component.css']
})
export class SupplierComponent implements OnInit {
  suppliers: any[] = [];

  supplierForm = {
    supplierName: '',
    phone: '',
    email: '',
    address: '',
    contactPerson: '',
    contactPersonPhone: '',
    openingBalance: 0.00
  };

  constructor(
    private supplierService: SupplierService,
    private alertService: AlertService,
    private cdr: ChangeDetectorRef  // Add this
  ) {}

  ngOnInit(): void {
    this.getAllSuppliers();
  }

  createSupplier(): void {
    if (!this.supplierForm.supplierName) {
      this.alertService.info('Please enter supplier name');
      return;
    }

    this.supplierService.createSupplier(this.supplierForm).subscribe({
      next: (response: any) => {
        this.alertService.success('Supplier created successfully!');
        this.resetForm();
        this.getAllSuppliers(); // Refresh the list after create
      },
      error: (err: any) => {
        console.error('Error creating supplier:', err);
        this.alertService.error('Failed to create supplier: ' + (err.error?.message || err.message));
      }
    });
  }

  getAllSuppliers() {
    this.supplierService.getAllSuppliers().subscribe({
      next: (response: any) => {
        console.log('Full response:', response);
        
        // Your response has success: true and data array
        if (response.success === true) {
          this.suppliers = response.data || [];
          this.cdr.detectChanges();
        } else {
          this.suppliers = [];
          console.log('Response success is false');
        }
      },
      error: (err: any) => {
        console.error('Error loading suppliers:', err);
        this.suppliers = [];
        this.alertService.error('Failed to load suppliers: ' + (err.error?.message || err.message));
      }
    });
  }

  resetForm(): void {
    this.supplierForm = {
      supplierName: '',
      phone: '',
      email: '',
      address: '',
      contactPerson: '',
      contactPersonPhone: '',
      openingBalance: 0
    };
  }
}