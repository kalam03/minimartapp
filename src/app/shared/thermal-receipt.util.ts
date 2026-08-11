import JsBarcode from 'jsbarcode';

// Shared thermal-receipt renderer — originally built (and still used) inside pos-billing.ts for
// the counter/POS page's post-sale receipt. Extracted here so any other page (e.g. Invoice Report's
// per-row "Print" button) can print the exact same receipt for a *past* sale, not just a live cart.
//
// `buildThermalReceiptHtml`/`printReceiptSilently` have zero component-state dependency — they only
// read from the `receipt` object and `printerModel` passed in. Callers are responsible for shaping
// their data into the same loose `receipt` object the counter page already builds (see pos-billing.ts
// submitBill() for the canonical shape): items: Array<{ product: { productId, productName }, unitPrice,
// quantity, subtotal }>, plus invoiceNo/customerName/customerPhone/saleDate/totalAmount/discount/
// discountPercent/promoDiscount/appliedPromotions/transportCost/transport/transportDetail/previousDue/
// roundOffAmount/netAmount/paymentType/paidAmount/returnAmount/dueAmount/customerId/generatedBy.

export enum ThermalPrinterModel {
  Pos58 = 'POS-58',
  XprinterXp80 = 'XPRINTER-XP-80',
}

export interface ReceiptPrintLayout {
  paperWidthMm: number;
  paddingMm: number;
  shopNameFontSizePx: number;
  itemFontSizePx: number;
  priceColumnWidthPx: number;
  quantityColumnWidthPx: number;
  amountColumnWidthPx: number;
  totalFontSizePx: number;
  barcodeWidth: number;
  barcodeHeight: number;
}

// Kept globally so every page (counter, invoice reprint, ...) shares the same locked receipt format/printer choice.
export const RECEIPT_PRINTER_STORAGE_KEY = 'pos-billing.receipt-printer-model';

export const RECEIPT_PRINT_LAYOUTS: Record<ThermalPrinterModel, ReceiptPrintLayout> = {
  [ThermalPrinterModel.Pos58]: {
    paperWidthMm: 58,
    paddingMm: 2,
    shopNameFontSizePx: 18,
    itemFontSizePx: 10,
    priceColumnWidthPx: 34,
    quantityColumnWidthPx: 22,
    amountColumnWidthPx: 40,
    totalFontSizePx: 11,
    barcodeWidth: 1.3,
    barcodeHeight: 32,
  },
  [ThermalPrinterModel.XprinterXp80]: {
    paperWidthMm: 80,
    paddingMm: 3,
    shopNameFontSizePx: 21,
    itemFontSizePx: 12,
    priceColumnWidthPx: 52,
    quantityColumnWidthPx: 34,
    amountColumnWidthPx: 60,
    totalFontSizePx: 13,
    barcodeWidth: 1.6,
    barcodeHeight: 40,
  },
};

export function getReceiptPrintLayout(printerModel: ThermalPrinterModel): ReceiptPrintLayout {
  return RECEIPT_PRINT_LAYOUTS[printerModel];
}

// Reads the shop's saved printer choice (set from the counter page's header dropdown); defaults to POS-58 if nothing valid is stored yet.
export function readStoredPrinterModel(
  defaultModel: ThermalPrinterModel = ThermalPrinterModel.Pos58,
): ThermalPrinterModel {
  const stored = localStorage.getItem(RECEIPT_PRINTER_STORAGE_KEY);
  if (stored === ThermalPrinterModel.Pos58 || stored === ThermalPrinterModel.XprinterXp80) {
    return stored;
  }
  return defaultModel;
}

export function writeStoredPrinterModel(printerModel: ThermalPrinterModel): void {
  localStorage.setItem(RECEIPT_PRINTER_STORAGE_KEY, printerModel);
}

// renders a CODE128 barcode to a standalone SVG string, dropped into the receipt HTML as static markup so the print iframe needs no script execution or network access
function generateBarcodeSvg(value: string, layout: ReceiptPrintLayout): string {
  try {
    const svgEl = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
    JsBarcode(svgEl, value, {
      format: 'CODE128',
      width: layout.barcodeWidth,
      height: layout.barcodeHeight,
      displayValue: true,
      fontSize: 9,
      margin: 0,
    });
    return new XMLSerializer().serializeToString(svgEl);
  } catch {
    // shouldn't happen (invoiceNo is always "INV-<number>", valid CODE128); fall back to plain text
    return `<div style="font-size:9px;">${value}</div>`;
  }
}

export function buildThermalReceiptHtml(receipt: any, printerModel: ThermalPrinterModel): string {
  const layout = getReceiptPrintLayout(printerModel);
  const formatTk = (amount: number): string => {
    return `৳ ${amount.toFixed(2)}`;
  };

  const escapeHtml = (str: string): string => {
    if (!str) return '';
    return str
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&#39;');
  };

  const formatDate = (date: Date): string => {
    const d = new Date(date);
    const day = d.getDate().toString().padStart(2, '0');
    const month = (d.getMonth() + 1).toString().padStart(2, '0');
    const year = d.getFullYear();
    const hours = d.getHours().toString().padStart(2, '0');
    const minutes = d.getMinutes().toString().padStart(2, '0');
    const seconds = d.getSeconds().toString().padStart(2, '0');
    return `${day}/${month}/${year} ${hours}:${minutes}:${seconds}`;
  };

  // Generate items HTML with fixed-width columns for thermal printer
  let itemsHtml = '';

  // Item table — a flexbox row (fixed-px numeric columns + flex:1 name),
  // NOT monospace text padded to a character count. Character-padding
  // (the previous approach) only lines up if every browser/printer driver
  // measures "1 monospace char" as exactly the same pixel width, which in
  // practice varies enough to either clip text past 58mm's ~204px printable
  // width or leave columns misaligned between the header and item rows.
  // Flexbox with explicit pixel widths lines up exactly, by construction,
  // regardless of font metrics — the same technique already used for
  // .total-line/.invoice-info elsewhere in this receipt.
  const itemRow = (
    name: string,
    price: string,
    qty: string,
    amount: string,
    bold = false,
  ): string => `
    <div class="item-row"${bold ? ' style="font-weight:700"' : ''}>
      <span class="item-col-name">${escapeHtml(name)}</span>
      <span class="item-col-price">${escapeHtml(price)}</span>
      <span class="item-col-qty">${escapeHtml(qty)}</span>
      <span class="item-col-amount">${escapeHtml(amount)}</span>
    </div>`;

  const itemsHeaderLine = itemRow('Item', 'Price', 'Qty', 'Amount', true);

  // Items
  receipt.items.forEach((item: any) => {
    itemsHtml += itemRow(
      item.product.productName,
      item.unitPrice.toFixed(0),
      item.quantity.toString(),
      item.subtotal.toFixed(0),
    );
  });

  // Calculate values from receipt object
  const subtotal = receipt.totalAmount || 0;
  const discount = receipt.discount || 0;
  const discountPercent = receipt.discountPercent || 0;
  const promoDiscount = receipt.promoDiscount || 0;
  const appliedPromotions: Array<{
    promotionType: string;
    description: string;
    discountAmount: number;
    freeItems?: Array<{ productId: number; qty: number; value: number }> | null;
  }> = receipt.appliedPromotions || [];
  // Resolve a free combo line's ProductId back to a name using the cart items
  // already on this receipt (the free product must be in the cart for the
  // combo to have qualified in the first place, so it's always found here).
  const freeItemProductName = (productId: number): string =>
    receipt.items.find((it: any) => it.product?.productId === productId)?.product?.productName ||
    `#${productId}`;
  const transportCost = receipt.transportCost || 0;
  const transport = receipt.transport || 'N/A';
  const transportDetail = receipt.transportDetail || '';
  const transportDetailLabel =
    receipt.transport === 'delivery'
      ? 'Delivery Man'
      : receipt.transport === 'courier'
        ? 'Courier'
        : receipt.transport === 'pickup'
          ? 'Picked Up By'
          : 'Assigned To';
  const prevDue = receipt.previousDue || 0;
  const roundOffAmount = receipt.roundOffAmount || 0;
  const netAmount =
    receipt.netAmount ||
    subtotal - discount - promoDiscount + transportCost + prevDue + roundOffAmount;
  const paidAmount = receipt.paidAmount || 0;
  const returnAmount = receipt.returnAmount || 0;
  const dueAmount = receipt.dueAmount || netAmount - paidAmount;
  const paymentType = receipt.paymentType || 'CASH';
  const invoiceNo = receipt.invoiceNo || 'N/A';
  const customerId = receipt.customerId || 'WALK-IN';
  const generatedBy = receipt.generatedBy || '';
  const invoiceBarcodeSvg = generateBarcodeSvg(invoiceNo, layout);

  // Get customer info (if available)
  const customerName = receipt.customerName || 'Walk-in Customer';
  const customerPhone = receipt.customerPhone || 'N/A';

  // Format date
  const saleDate = formatDate(receipt.saleDate || new Date());
  const dateStr = new Date(receipt.saleDate || new Date())
    .toLocaleDateString('en-GB', {
      day: '2-digit',
      month: 'short',
      year: 'numeric',
    })
    .toUpperCase();

  const timeStr = new Date(receipt.saleDate || new Date()).toLocaleTimeString('en-US', {
    hour: '2-digit',
    minute: '2-digit',
    hour12: true,
  });

  return `
    <!DOCTYPE html>
    <html>
      <head>
        <meta charset="UTF-8">
        <meta name="viewport" content="width=device-width, initial-scale=1.0">
        <title>MiniMart Receipt - ${invoiceNo}</title>
        <style>
          * {
            margin: 0;
            padding: 0;
            box-sizing: border-box;
          }

          body {
            font-family: 'Courier New', 'Monaco', monospace;
            background: #fff;
            color: #000;
            margin: 0;
            padding: 0;
          }

          .receipt {
            width: ${layout.paperWidthMm}mm;
            margin: 0;
            background: #fff;
            color: #000;
            padding: ${layout.paddingMm}mm;
          }

          @media print {
            body {
              background: #fff;
              margin: 0;
              padding: 0;
            }
            .receipt {
              padding: ${layout.paddingMm}mm;
              width: ${layout.paperWidthMm}mm;
            }
          }

          .text-center {
            text-align: center;
          }

          .text-right {
            text-align: right;
          }

          .text-left {
            text-align: left;
          }

          .shop-name {
            font-size: ${layout.shopNameFontSizePx}px;
            font-weight: bold;
            letter-spacing: 2px;
          }

          .shop-address {
            font-size: 9px;
            color: #000;
            font-weight: 600;
            margin-top: 4px;
          }

          .separator {
            border-top: 1px dashed #000;
            margin: 8px 0;
          }

          .separator-double {
            border-top: 2px solid #000;
            margin: 8px 0;
          }

          /* Item table — flexbox row with fixed-px numeric columns, not
             monospace text padded to a character count. This is what makes
             the header and every item row line up EXACTLY: CSS box widths
             are precise regardless of font/browser/printer-driver metrics,
             where counting "monospace characters" is only ever an estimate.
             .receipt is 58mm with 2mm padding each side (~204px printable at
             96dpi) — 34+22+40=96px of fixed numeric columns leaves
             flex:1 / ~100px+ for the name, comfortably within budget. */
          .item-row {
            display: flex;
            align-items: baseline;
            font-family: 'Courier New', monospace;
            font-size: ${layout.itemFontSizePx}px;
            font-weight: 600;
            color: #000;
            margin: 2px 0;
          }
          .item-col-name {
            flex: 1;
            min-width: 0;
            overflow: hidden;
            text-overflow: ellipsis;
            white-space: nowrap;
            padding-right: 2px;
          }
          .item-col-price, .item-col-qty, .item-col-amount {
            flex: none;
            text-align: right;
            white-space: nowrap;
          }
          .item-col-price  { width: ${layout.priceColumnWidthPx}px; }
          .item-col-qty    { width: ${layout.quantityColumnWidthPx}px; }
          .item-col-amount { width: ${layout.amountColumnWidthPx}px; }

          .total-line {
            display: flex;
            justify-content: space-between;
            margin: 4px 0;
            font-size: ${layout.totalFontSizePx}px;
            font-weight: 600;
            color: #000;
          }

          .total-line-bold {
            font-weight: bold;
            font-size: ${layout.totalFontSizePx + 1}px;
          }

          .due-line {
            border-top: 1px double #000;
            margin-top: 6px;
            padding-top: 6px;
            font-weight: bold;
          }

          .receipt-footer {
            margin-top: 12px;
            text-align: center;
            font-size: 9px;
            color: #000;
            font-weight: 600;
          }

          .invoice-info {
            font-size: 9px;
            font-weight: 600;
            color: #000;
            margin: 6px 0;
            display: flex;
            justify-content: space-between;
            flex-wrap: wrap;
            gap: 4px;
          }

          .payment-method {
            display: inline-block;
            padding: 2px 6px;
            background: #eee;
            color: #000;
            font-weight: bold;
          }

          .thankyou {
            margin-top: 12px;
            padding-top: 8px;
            border-top: 1px dashed #000;
            text-align: center;
            font-style: italic;
          }

          .barcode-section {
            margin-top: 10px;
            text-align: center;
          }

          .barcode-section svg {
            max-width: 100%;
            height: auto;
          }

          @page {
            size: ${layout.paperWidthMm}mm auto;
            margin: 0mm;
          }
        </style>
      </head>
      <body>
        <div class="receipt">
          <!-- Shop Header -->
          <div class="text-center">
            <div class="shop-name">LUCKY SHOP</div>
            <div class="shop-address">আড়াইহাজার বাজার, ব্যাটারী গলির দক্ষিণ পাশে, বাঁশ পট্টি নতুন রাস্তার মোড়</div>
            <div class="shop-address">Tel: 01716881160</div>

          </div>

          <div class="separator"></div>

          <!-- Invoice Info -->
          <div class="invoice-info">
            <span>INV: ${escapeHtml(invoiceNo)}</span>
            <span>Date: ${dateStr}</span>
          </div>
          <div class="invoice-info">
            <span>Time: ${timeStr}</span>
            <span>Customer: ${escapeHtml(customerId.toString())}</span>
          </div>
          <div class="invoice-info">
            <span>${escapeHtml(customerName)}</span>
            <span>Tel: ${escapeHtml(customerPhone)}</span>
          </div>

          <div class="separator"></div>

          <!-- Items table — header + rows are both built by itemRow() above,
               a flexbox row, so the columns are pixel-aligned by CSS layout
               rather than by counting monospace characters. -->
          <div>
            ${itemsHeaderLine}
            <div class="separator" style="margin-top: 2px;"></div>
            ${itemsHtml}
            <div class="separator"></div>
          </div>

          <!-- Totals -->
          <div>
            <div class="total-line">
              <span>Subtotal:</span>
              <span>${formatTk(subtotal)}</span>
            </div>

            ${
              discount > 0
                ? `
            <div class="total-line">
              <span>Discount (${discountPercent}%):</span>
              <span>-${formatTk(discount)}</span>
            </div>
            `
                : ''
            }

            <!-- Auto product-wise/combo discounts (PromotionEngineService) —
                 one line per applied promotion so a combo discount is named
                 and visible, not just silently folded into Net Total. Falls
                 back to a single lump "Promo Discount" line if the list is
                 empty but a total is present, in case an older/partial
                 receipt payload doesn't carry the itemized list. -->
            ${
              appliedPromotions.length > 0
                ? appliedPromotions
                    .map(
                      (p) => `
            <div class="total-line">
              <span>${p.promotionType === 'Combo' ? 'Combo' : 'Discount'}: ${escapeHtml(p.description || '')}</span>
              <span>-${formatTk(p.discountAmount || 0)}</span>
            </div>
            ${(p.freeItems || [])
              .map(
                (f) => `
            <div class="total-line" style="padding-left:6px;font-size:10px">
              <span>&nbsp;&nbsp;Free: ${escapeHtml(freeItemProductName(f.productId))} x${f.qty}</span>
              <span>(${formatTk(f.value || 0)} value)</span>
            </div>
            `,
              )
              .join('')}
            `,
                    )
                    .join('')
                : promoDiscount > 0
                  ? `
            <div class="total-line">
              <span>Promo Discount:</span>
              <span>-${formatTk(promoDiscount)}</span>
            </div>
            `
                  : ''
            }

            ${
              transportCost > 0
                ? `
            <div class="total-line">
              <span>Transport (${escapeHtml(transport)}):</span>
              <span>${formatTk(transportCost)}</span>
            </div>
            `
                : ''
            }
            ${
              transportDetail
                ? `
            <div class="total-line">
              <span>${transportDetailLabel}:</span>
              <span>${escapeHtml(transportDetail)}</span>
            </div>
            `
                : ''
            }
            ${
              prevDue > 0
                ? `
            <div class="total-line" style="color:#000; font-weight:bold">
              <span>Previous Due:</span>
              <span>+${formatTk(prevDue)}</span>
            </div>
            `
                : ''
            }
            ${
              prevDue < 0
                ? `
            <div class="total-line" style="color:#000; font-weight:bold">
              <span>Advance Credit:</span>
              <span>-${formatTk(Math.abs(prevDue))}</span>
            </div>
            `
                : ''
            }
            ${
              roundOffAmount !== 0
                ? `
            <div class="total-line" style="color:#000; font-weight:bold">
              <span>Round Off:</span>
              <span>${roundOffAmount > 0 ? '+' : '-'}${formatTk(Math.abs(roundOffAmount))}</span>
            </div>
            `
                : ''
            }
          </div>

          <div class="separator"></div>

          <!-- Net Amount -->
          <div class="total-line total-line-bold">
            <span>NET TOTAL:</span>
            <span>${formatTk(netAmount)}</span>
          </div>

          <div class="separator"></div>

          <!-- Payment Details -->
          <div>
            <div class="total-line">
              <span>Payment Method:</span>
              <span class="payment-method">${escapeHtml(paymentType.toUpperCase())}</span>
            </div>
            <div class="total-line">
              <span>Paid Amount:</span>
              <span>${formatTk(paidAmount)}</span>
            </div>
            ${
              returnAmount > 0
                ? `
            <div class="total-line">
              <span>Return Amount:</span>
              <span>${formatTk(returnAmount)}</span>
            </div>
            `
                : ''
            }
          </div>

          ${
            dueAmount > 0
              ? `
          <div class="due-line">
            <div class="total-line total-line-bold">
              <span>*** DUE AMOUNT ***:</span>
              <span style="color: #000;">${formatTk(dueAmount)}</span>
            </div>
          </div>
          `
              : ''
          }

          ${
            dueAmount === 0 && paidAmount > 0
              ? `
          <div class="due-line">
            <div class="total-line total-line-bold">
              <span>PAID IN FULL</span>
              <span>${formatTk(paidAmount)}</span>
            </div>
          </div>
          `
              : ''
          }

          <div class="separator"></div>

          <!-- Footer -->
          <div class="thankyou">
            <div>Thank you for shopping!</div>
            <div style="font-size: 8px; margin-top: 4px;">** This is a computer generated receipt **</div>
            <div style="font-size: 8px;">** No signature required **</div>
          </div>

          <div class="receipt-footer">
            <div>Tel: 01716881160</div>
            <div>Visit us again!</div>
            <div style="margin-top: 4px;">Have a great day!</div>
            ${generatedBy ? `<div style="margin-top: 4px;">Generated by: ${escapeHtml(generatedBy)}</div>` : ''}
          </div>

          <!-- Barcode: encodes the invoice number, printed at the very bottom -->
          <div class="barcode-section">
            ${invoiceBarcodeSvg}
          </div>

        </div>
      </body>
    </html>
  `;
}

// Silently print the receipt to the thermal printer via a hidden iframe —
// nothing is shown to the user and no click is required beyond the native print dialog (unless the browser runs with a silent-print flag e.g. Chrome's --kiosk-printing).
export function printReceiptSilently(receiptHtml: string): void {
  const iframe = document.createElement('iframe');
  iframe.style.position = 'fixed';
  iframe.style.right = '0';
  iframe.style.bottom = '0';
  iframe.style.width = '0';
  iframe.style.height = '0';
  iframe.style.border = '0';
  iframe.setAttribute('aria-hidden', 'true');
  document.body.appendChild(iframe);

  let cleaned = false;
  const cleanup = () => {
    if (cleaned) return;
    cleaned = true;
    // Small delay so the print job has actually been handed off before we
    // tear down the iframe it's printing from.
    setTimeout(() => {
      if (iframe.parentNode) {
        iframe.parentNode.removeChild(iframe);
      }
    }, 1000);
  };

  const doc = iframe.contentWindow?.document;
  if (!doc) {
    cleanup();
    return;
  }

  doc.open();
  doc.write(receiptHtml);
  doc.close();

  iframe.onload = () => {
    const win = iframe.contentWindow;
    if (!win) {
      cleanup();
      return;
    }
    win.addEventListener('afterprint', cleanup, { once: true });
    win.focus();
    win.print();
    // Fallback in case 'afterprint' never fires in some browser/driver setups.
    cleanup();
  };
}
