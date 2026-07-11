import { Component } from '@angular/core';
import { CommonModule } from '@angular/common';
import { SalesSummaryReportComponent } from './sales-summary-report.component';
import { SalesDetailsReportComponent } from './sales-details-report.component';
import { InvoiceReportComponent } from './invoice-report.component';
import { ProfitReportComponent } from './profit-report.component';

type ReportTab = 'sales-summary' | 'sales-details' | 'invoice-report' | 'profit-report';

@Component({
  selector: 'app-reports-hub',
  standalone: true,
  imports: [
    CommonModule,
    SalesSummaryReportComponent,
    SalesDetailsReportComponent,
    InvoiceReportComponent,
    ProfitReportComponent
  ],
  templateUrl: './reports-hub.component.html',
  styleUrls: ['./reports-hub.component.css']
})
export class ReportsHubComponent {
  activeTab: ReportTab = 'sales-summary';

  tabs: { id: ReportTab; label: string }[] = [
    { id: 'sales-summary',  label: 'Sales Summary' },
    { id: 'sales-details',  label: 'Sales Details' },
    { id: 'invoice-report', label: 'Invoice Report' },
    { id: 'profit-report',  label: 'Profit Report' }
  ];

  setTab(tab: ReportTab): void {
    this.activeTab = tab;
  }
}
