import { Injectable } from '@angular/core';
import { environment } from '../../environments/environment';

/**
 * Loads the API base URL from /config.json at app startup — a plain static
 * file copied verbatim into the build output (see angular.json's "assets"
 * entry for the "public" folder), NOT compiled/inlined by the TypeScript
 * build the way environment.ts/environment.prod.ts are.
 *
 * Why this exists: environment.ts's baseUrl gets baked into the JS bundle
 * at `ng build` time — changing it means editing the source, rebuilding,
 * and redeploying the whole app. With this in place, "build once, deploy
 * many" works instead: after deploying, just edit config.json on the
 * server (e.g. the file sitting next to index.html in the deployed output)
 * and refresh the browser. No rebuild, no redeploy.
 *
 * Wired up via provideAppInitializer() in app.config.ts, so load() always
 * finishes — and environment.baseUrl is patched with the real value —
 * before any component or service gets a chance to make its first HTTP
 * call. environment.baseUrl itself becomes just the fallback used if
 * config.json is missing or fails to load (e.g. a bare `ng serve` with
 * nothing deployed yet).
 *
 * NOTE: config.json is deliberately NOT matched by any glob in
 * ngsw-config.json (the service worker's asset groups only list
 * favicon/html/css/js/images) — if that ever changes, this file would
 * start being cached by the service worker and stop picking up edits
 * without a full SW update, defeating the whole point.
 */
@Injectable({ providedIn: 'root' })
export class AppConfigService {
  // Same runtime-toggle idea as apiBaseUrl above: whether the "Price" field
  // on Counter/POS Billing (isSellingEditable) and the "Cost Price" field on
  // Purchases (isBuyingEditable) are user-editable, or locked read-only to
  // the product's catalog price. Toggle in config.json on the server — no
  // rebuild/redeploy needed. Default true so the app behaves the same as
  // before this existed if config.json is ever missing/outdated.
  isSellingEditable = true;
  isBuyingEditable  = true;

  async load(): Promise<void> {
    try {
      // Cache-bust with both a query param and cache: 'no-store' — we can't
      // control what Cache-Control headers the eventual production web
      // server (IIS/nginx/whatever) sends for static files, and the whole
      // point of this file is that edits must show up on next page load.
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
    } catch {
      // config.json missing/unreachable — silently keep whatever
      // defaults are already set above.
    }
  }
}
