// services/receipt.service.ts
import { Injectable } from '@angular/core';

export interface ReceiptData {
  shopName: string;
  shopAddressLine1: string;
  email: string;
  mobile1: string;
  mobile2: string;
  customerMobile: string;
  generatedBy: string;
  itemsDetailed: ReceiptItem[];
  subtotal: number;
  transportCost: number;
  totalBeforeDiscount: number;
  discount: number;
  grossAmount: number;
  paid: number;
  due: number;
  paymentMethod: string;
  date: string;
  invoiceTitle: string;
}

export interface ReceiptItem {
  name: string;
  quantity: number;
  unitPrice: number;
  total: number;
}

@Injectable({
  providedIn: 'root'
})
export class ReceiptService {
  
  // Static data as per your requirements
  private staticReceiptData: ReceiptData = {
    shopName: "Minimar Shop",
    shopAddressLine1: "Dhaka, mirpur-10, kazipara-123",
    email: "minimart@gmail.com",
    mobile1: "0151111111",
    mobile2: "0133211111",
    customerMobile: "01611111111",
    generatedBy: "admin1",
    itemsDetailed: [
      { name: "Item1", quantity: 10, unitPrice: 80, total: 800 },
      { name: "Item2", quantity: 2, unitPrice: 50, total: 100 },
      { name: "Item3", quantity: 5, unitPrice: 20, total: 100 }
    ],
    subtotal: 1000,
    transportCost: 200,
    totalBeforeDiscount: 1200,
    discount: 100,
    grossAmount: 1100,
    paid: 1000,
    due: 100,
    paymentMethod: "Bkash",
    date: "22-APR-2026",
    invoiceTitle: "INVICE RECEIPT"
  };

  getReceiptData(): ReceiptData {
    return this.staticReceiptData;
  }

  updateReceiptData(data: Partial<ReceiptData>): void {
    this.staticReceiptData = { ...this.staticReceiptData, ...data };
    // Recalculate totals if needed
    this.recalculateTotals();
  }

  private recalculateTotals(): void {
    // Recalculate subtotal from items
    this.staticReceiptData.subtotal = this.staticReceiptData.itemsDetailed.reduce(
      (sum, item) => sum + item.total, 0
    );
    
    // Recalculate total before discount
    this.staticReceiptData.totalBeforeDiscount = 
      this.staticReceiptData.subtotal + this.staticReceiptData.transportCost;
    
    // Recalculate gross amount
    this.staticReceiptData.grossAmount = 
      this.staticReceiptData.totalBeforeDiscount - this.staticReceiptData.discount;
    
    // Recalculate due
    this.staticReceiptData.due = 
      this.staticReceiptData.grossAmount - this.staticReceiptData.paid;
  }

  formatTk(amount: number): string {
    return amount.toFixed(2).replace(/\.00$/, '') + " tk";
  }

  buildThermalReceiptHTML(data?: ReceiptData): string {
    const receiptData = data || this.staticReceiptData;
    
    let itemsHtml = '';
    receiptData.itemsDetailed.forEach(item => {
      itemsHtml += `
        <div class="item-row">
          <span style="flex:2; word-break:break-word;">${this.escapeHtml(item.name)}</span>
          <span style="margin-right: 8px;">${item.quantity}*${item.unitPrice}</span>
          <span style="font-weight:500;">${this.formatTk(item.total)}</span>
        </div>
      `;
    });

    return `
      <div class="center">
        <div style="font-size: 16px; font-weight: 800; letter-spacing: 1px;">📄 INVICE RECEIPT</div>
        <div class="shop-name">${this.escapeHtml(receiptData.shopName)}</div>
        <div style="font-size: 11px;">${this.escapeHtml(receiptData.shopAddressLine1)}</div>
        <div style="font-size: 10px;">✉️ ${this.escapeHtml(receiptData.email)} | 📞 ${this.escapeHtml(receiptData.mobile1)}, ${this.escapeHtml(receiptData.mobile2)}</div>
      </div>
      <hr />
      <div class="summary-line">
        <span>📞 Customer mobile: ${this.escapeHtml(receiptData.customerMobile)}</span>
        <span>⚙️ Generate BY: ${this.escapeHtml(receiptData.generatedBy)}</span>
      </div>
      <hr class="dashed-light" />
      <div><strong>Items:</strong></div>
      ${itemsHtml}
      <hr />
      <div class="summary-line"><span>Subtotal :</span><span>${this.formatTk(receiptData.subtotal)}</span></div>
      <div class="summary-line"><span>Transport cost :</span><span>${this.formatTk(receiptData.transportCost)}</span></div>
      <hr class="dashed-light" />
      <div class="summary-line"><span>Total :</span><span>${this.formatTk(receiptData.totalBeforeDiscount)}</span></div>
      <div class="summary-line"><span>Discount :</span><span>- ${this.formatTk(receiptData.discount)}</span></div>
      <hr class="dashed-light" />
      <div class="summary-line total-row"><span>Gross :</span><span>${this.formatTk(receiptData.grossAmount)}</span></div>
      <div class="summary-line"><span>Paid :</span><span>${this.formatTk(receiptData.paid)}</span></div>
      <hr />
      <div class="summary-line due-row"><span>Due</span><span class="due-amount">${this.formatTk(receiptData.due)}</span></div>
      <hr class="dashed-light" />
      <div class="payment-method">
        <span>💵 Payment method : ${this.escapeHtml(receiptData.paymentMethod)}</span>
        <span>📆 date: ${this.escapeHtml(receiptData.date)}</span>
      </div>
      <hr />
      <div class="footer-message">===== Take Care yourself =====</div>
      <div class="center small-detail" style="margin-top: 8px;">🇧🇩 Thank you | MiniMart POS</div>
    `;
  }

  printReceipt(receiptHTML: string): void {
    const printWindow = window.open('', '_blank', 'width=450,height=600');
    if (!printWindow) {
      alert("Please allow pop-ups to print receipt");
      return;
    }
    
    printWindow.document.write(`
      <!DOCTYPE html>
      <html>
        <head>
          <meta charset="UTF-8">
          <meta name="viewport" content="width=device-width, initial-scale=1.0">
          <title>MiniMart Thermal Receipt</title>
          <style>
            * { margin: 0; padding: 0; box-sizing: border-box; }
            body {
              background: white;
              font-family: 'Courier New', monospace;
              padding: 0.8rem;
              width: 100%;
              display: flex;
              justify-content: center;
            }
            .print-receipt {
              max-width: 350px;
              width: 100%;
              margin: 0 auto;
              background: white;
              padding: 0.6rem;
            }
            .print-receipt * {
              font-family: 'Courier New', monospace;
              font-size: 12px;
              line-height: 1.45;
            }
            .item-row { display: flex; justify-content: space-between; margin: 4px 0; flex-wrap: wrap; }
            .summary-line { display: flex; justify-content: space-between; margin: 4px 0; }
            .total-row { font-weight: 800; margin-top: 6px; }
            .due-row { font-weight: 800; border-top: 1px double #000; margin-top: 4px; padding-top: 4px; }
            .due-amount { color: #b91c1c; }
            hr { border: none; border-top: 1px dashed #000; margin: 8px 0; }
            .center { text-align: center; }
            .shop-name { font-weight: 800; font-size: 16px; }
            .footer-message { text-align: center; margin-top: 10px; }
            .payment-method { display: flex; justify-content: space-between; margin: 6px 0; }
          </style>
        </head>
        <body>
          <div class="print-receipt">
            ${receiptHTML}
          </div>
          <script>
            window.onload = () => {
              window.print();
              setTimeout(() => window.close(), 500);
            };
          <\/script>
        </body>
      </html>
    `);
    printWindow.document.close();
  }

  private escapeHtml(str: string): string {
    if (!str) return '';
    return str.replace(/[&<>]/g, function(m) {
      if (m === '&') return '&amp;';
      if (m === '<') return '&lt;';
      if (m === '>') return '&gt;';
      return m;
    });
  }
}