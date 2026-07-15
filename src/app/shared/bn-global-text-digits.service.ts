// shared/bn-global-text-digits.service.ts
//
// Bangla-digit support for READ-ONLY numeric text — dashboard cards, grid
// cells, totals, badges, IDs, anything rendered via plain `{{ }}` or Angular's
// `number`/`currency`/`date` pipes. BnNumberAccessorDirective (and
// FinancialInputComponent) already cover *editable* inputs; this service is
// the other half — it covers numbers that come from the API and are simply
// displayed, wherever in the DOM they end up, without needing `| bnDigits`
// (or any other template change) added to every single interpolation across
// the app.
//
// HOW
// Once bootstrapped (see app.config.ts's provideAppInitializer), this:
//   1. Walks the whole rendered DOM once (convertAll) and swaps digit glyphs
//      to match the active language.
//   2. Starts a MutationObserver on <body> (childList + subtree +
//      characterData) so any text Angular renders *afterwards* — API data
//      arriving async, pagination, filtering, route changes, anything — gets
//      the same treatment the instant it lands in the DOM. This is what
//      makes it "global": no per-component wiring, ever.
//   3. Re-walks the whole DOM whenever the language signal flips, so
//      everything already on screen switches digit systems immediately
//      (including converting back to English if the user switches back).
//
// SAFETY
// - `applying` guards against reacting to mutations *we* just made (without
//   it, our own text-node writes would re-trigger the observer forever).
// - Conversion is idempotent either direction: enToBn on Bangla-only text and
//   bnToEn on English-only text are both no-ops, so re-processing already-
//   converted content never causes flicker or infinite loops.
// - <script>/<style>/<iframe>/<noscript> subtrees are skipped outright.
//   Actual form controls (<input>, <textarea>) don't expose their live value
//   as a child text node in the DOM, so this never touches them — editable
//   numeric fields are exclusively handled by BnNumberAccessorDirective /
//   FinancialInputComponent, which manage the model value, not just display.
import { DOCUMENT } from '@angular/common';
import { Injectable, Injector, effect, inject } from '@angular/core';
import { LanguageService } from '../services/language.service';
import { bnToEn, enToBn } from './bn-numerals';

const SKIP_TAGS = new Set(['SCRIPT', 'STYLE', 'IFRAME', 'NOSCRIPT']);

@Injectable({ providedIn: 'root' })
export class BnGlobalTextDigitsService {
  private readonly document = inject(DOCUMENT);
  private readonly languageService = inject(LanguageService);
  // Captured here (constructor-time injection context is always guaranteed)
  // and handed to effect() explicitly below — init() is called from inside
  // an app initializer callback, and rather than rely on Angular's
  // injection-context propagating into that nested call, passing the
  // injector directly removes any doubt.
  private readonly injector = inject(Injector);

  private observer: MutationObserver | null = null;
  private applying = false;

  /** Call once at app startup (see app.config.ts). */
  init(): void {
    if (this.observer) return; // already initialized

    this.observer = new MutationObserver((mutations) => this.handleMutations(mutations));
    this.observer.observe(this.document.body, {
      childList: true,
      subtree: true,
      characterData: true,
    });

    // Signals integrate directly with Angular's reactivity graph — effect()
    // re-runs this synchronously every time currentLanguage() actually
    // changes, with no polling and no dependency on unrelated DOM churn.
    // This also does the very first conversion pass (effects run once
    // immediately on creation), so a separate initial convertAll() call
    // isn't needed.
    effect(
      () => {
        this.languageService.currentLanguage();
        this.convertAll();
      },
      { injector: this.injector }
    );
  }

  private handleMutations(mutations: MutationRecord[]): void {
    if (this.applying) return;
    this.applying = true;
    try {
      for (const m of mutations) {
        if (m.type === 'characterData' && m.target.nodeType === Node.TEXT_NODE) {
          this.convertNode(m.target as Text);
        } else if (m.type === 'childList') {
          m.addedNodes.forEach((n) => this.convertSubtree(n));
        }
      }
    } finally {
      this.applying = false;
    }
  }

  private convertAll(): void {
    this.applying = true;
    try {
      this.convertSubtree(this.document.body);
    } finally {
      this.applying = false;
    }
  }

  private convertSubtree(root: Node): void {
    if (root.nodeType === Node.TEXT_NODE) {
      this.convertNode(root as Text);
      return;
    }
    if (root.nodeType !== Node.ELEMENT_NODE && root.nodeType !== Node.DOCUMENT_FRAGMENT_NODE) {
      return;
    }
    const el = root as Element;
    if (SKIP_TAGS.has(el.tagName)) return;

    const walker = this.document.createTreeWalker(root, NodeFilter.SHOW_TEXT, {
      acceptNode: (node) => {
        const parent = (node as Text).parentElement;
        if (parent && SKIP_TAGS.has(parent.tagName)) return NodeFilter.FILTER_REJECT;
        return NodeFilter.FILTER_ACCEPT;
      },
    });
    let node: Node | null;
    while ((node = walker.nextNode())) {
      this.convertNode(node as Text);
    }
  }

  private convertNode(node: Text): void {
    const text = node.textContent;
    if (!text) return;
    const isBangla = this.languageService.currentLanguage() === 'bn';
    const converted = isBangla ? enToBn(text) : bnToEn(text);
    if (converted !== text) {
      node.textContent = converted;
    }
  }
}
