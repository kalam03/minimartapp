import { Injectable } from '@angular/core';
import { environment } from '../../environments/environment';

export interface PaymentMethodConfig {
  id: 'bKash' | 'Nagad' | 'Rocket' | 'Bank';
  label: string;
  color: string;
  instructions: string;
  accountNumber?: string;
  accountType?: string;
  bankName?: string;
  accountName?: string;
  branch?: string;
  routingNumber?: string;
}

// Runtime config: config.json (deployed static asset, not compiled in) overrides environment.baseUrl at startup so builds can be redeployed without rebuilding; must stay excluded from ngsw-config.json's asset groups or the service worker will cache it and stop picking up edits.
@Injectable({ providedIn: 'root' })
export class AppConfigService {
  // Runtime-toggle via config.json (like apiBaseUrl above); defaults true if config.json is missing/outdated.
  isSellingEditable = true;
  isBuyingEditable  = true;
  // Whether confirming a counter-page sale also opens the styled PDF invoice in a new tab (on top of the thermal receipt, which always prints). Off by default — see config.json "isInvoice".
  isInvoiceEnabled = false;
  // Send Money instructions/account numbers for the subscription Payment page — no merchant account, so edit this array directly in config.json to change numbers/instructions without a rebuild.
  paymentMethods: PaymentMethodConfig[] = [];

  async load(): Promise<void> {
    try {
      // Cache-bust (query param + no-store) so config.json edits show up without a hard refresh.
      const res = await fetch(`config.json?t=${Date.now()}`, { cache: 'no-store' });
      if (!res.ok) return; // no config.json deployed — keep the environment.ts fallback

      const config = await res.json();
      if (config?.apiBaseUrl) {
        environment.baseUrl = config.apiBaseUrl;
      }
      if (typeof config?.isSellingEditable === 'boolean') {
        this.isSellingEditable = config.isSellingEditable;
      }
      if (typeof config?.isBuyingEditable === 'boolean') {
        this.isBuyingEditable = config.isBuyingEditable;
      }
      if (typeof config?.isInvoice === 'boolean') {
        this.isInvoiceEnabled = config.isInvoice;
      }
      if (Array.isArray(config?.payment?.methods)) {
        this.paymentMethods = config.payment.methods;
      }
    } catch {
      // config.json missing/unreachable — keep the defaults already set above.
    }
  }
}
