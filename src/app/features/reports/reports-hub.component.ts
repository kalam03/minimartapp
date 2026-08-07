import { Component } from '@angular/core';
import { CommonModule } from '@angular/common';
import { TranslocoModule, provideTranslocoScope } from '@jsverse/transloco';
import { SalesSummaryReportComponent } from './sales-summary-report.component';
import { SalesDetailsReportComponent } from './sales-details-report.component';
import { InvoiceReportComponent } from './invoice-report.component';
import { ProfitReportComponent } from './profit-report.component';
import { PaymentMethodSummaryReportComponent } from './payment-method-summary-report.component';
import { CustomerReportComponent } from './customer-report.component';
import { SupplierReportComponent } from './supplier-report.component';

type ReportTab = 'sales-summary' | 'sales-details' | 'invoice-report' | 'profit-report' | 'payment-method-summary' | 'customer-report' | 'supplier-report';

@Component({
  selector: 'app-reports-hub',
  standalone: true,
  imports: [
    CommonModule,
    TranslocoModule,
    SalesSummaryReportComponent,
    SalesDetailsReportComponent,
    InvoiceReportComponent,
    ProfitReportComponent,
    PaymentMethodSummaryReportComponent,
    CustomerReportComponent,
    SupplierReportComponent
  ],
  //Loads assets/i18n/reports/{en,bn}.json only when this route is hit — see Multilingual_Localization_Architecture.md Section 5.1
  providers: [provideTranslocoScope('reports')],
  templateUrl: './reports-hub.component.html',
  styleUrls: ['./reports-hub.component.css']
})
export class ReportsHubComponent {
  activeTab: ReportTab = 'sales-summary';

  tabs: { id: ReportTab; labelKey: string }[] = [
    { id: 'sales-summary',  labelKey: 'reports.hub.tabs.salesSummary' },
    { id: 'sales-details',  labelKey: 'reports.hub.tabs.salesDetails' },
    { id: 'invoice-report', labelKey: 'reports.hub.tabs.invoiceReport' },
    { id: 'profit-report',  labelKey: 'reports.hub.tabs.profitReport' },
    { id: 'payment-method-summary', labelKey: 'reports.hub.tabs.paymentMethodSummary' },
    { id: 'customer-report', labelKey: 'reports.hub.tabs.customerReport' },
    { id: 'supplier-report', labelKey: 'reports.hub.tabs.supplierReport' }
  ];

  setTab(tab: ReportTab): void {
    this.activeTab = tab;
  }
}
