// services/language.service.ts
import { Injectable, signal } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { TranslocoService } from '@jsverse/transloco';
import { environment } from '../../environments/environment';

export interface AppLanguage {
  code: 'en' | 'bn';
  label: string;       // English name, shown as the fallback/collapsed label
  nativeLabel: string; // name in its own language — "English" / "বাংলা"
}

const STORAGE_KEY = 'mma-lang';
const COOKIE_KEY = 'lang';

export const APP_LANGUAGES: AppLanguage[] = [
  { code: 'en', label: 'English', nativeLabel: 'English' },
  { code: 'bn', label: 'Bangla', nativeLabel: 'বাংলা' },
];

@Injectable({ providedIn: 'root' })
export class LanguageService {
  readonly languages = APP_LANGUAGES;

  currentLanguage = signal<string>(this.readInitialLanguage());

  constructor(
    private transloco: TranslocoService,
    private http: HttpClient,
  ) {
    this.transloco.setActiveLang(this.currentLanguage());
  }

  /** Called from the header dropdown (layout.component.html). */
  setLanguage(code: string): void {
    if (!this.languages.some(l => l.code === code)) return;
    this.currentLanguage.set(code);
    this.transloco.setActiveLang(code);
    this.persist(code);

    // Best-effort: persist to the logged-in user's profile too, so the
    // choice survives a login on a different browser/device — not just
    // this one (localStorage/cookie only cover the current browser).
    // Fire-and-forget: the UI has already switched by the time this
    // resolves, and an anonymous/offline caller (e.g. the login screen
    // itself) simply has nothing to PUT to yet.
    this.http.put(`${environment.baseUrl}/users/preferences/language`, { language: code }).subscribe({
      error: () => { /* not logged in yet, or offline — localStorage/cookie already cover it */ },
    });
  }

  getLanguage(code: string): AppLanguage | undefined {
    return this.languages.find(l => l.code === code);
  }

  /**
   * Called once by AuthService right after a successful login response —
   * reconciles the device-local choice with whatever the user last saved
   * to their profile on ANY device. Only switches if it's actually
   * different, so it never fights the header dropdown mid-session.
   */
  syncFromUserProfile(preferredLanguage: string | null | undefined): void {
    if (preferredLanguage && preferredLanguage !== this.currentLanguage()) {
      this.setLanguage(preferredLanguage);
    }
  }

  private persist(code: string): void {
    try {
      localStorage.setItem(STORAGE_KEY, code);
    } catch {
      /* localStorage unavailable — ignore, cookie still covers it */
    }
    document.cookie = `${COOKIE_KEY}=${code}; path=/; max-age=${365 * 24 * 60 * 60}; SameSite=Lax`;
  }

  /** Priority: localStorage → cookie → browser language → 'en'. */
  private readInitialLanguage(): string {
    try {
      const saved = localStorage.getItem(STORAGE_KEY);
      if (saved && this.languages.some(l => l.code === saved)) return saved;
    } catch {
      /* ignore */
    }

    const cookieMatch = document.cookie.match(/(?:^|;\s*)lang=([^;]+)/);
    if (cookieMatch && this.languages.some(l => l.code === cookieMatch[1])) return cookieMatch[1];

    const browserLang = navigator.language?.slice(0, 2);
    if (browserLang && this.languages.some(l => l.code === browserLang)) return browserLang;

    return 'en';
  }
}
