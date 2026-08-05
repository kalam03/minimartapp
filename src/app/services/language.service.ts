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

  setLanguage(code: string): void {
    if (!this.languages.some(l => l.code === code)) return;
    this.currentLanguage.set(code);
    this.transloco.setActiveLang(code);
    this.persist(code);

    //Fire-and-forget: syncs choice to the user's profile so it survives login on another device
    this.http.put(`${environment.baseUrl}/users/preferences/language`, { language: code }).subscribe({
      error: () => { /* not logged in yet, or offline — localStorage/cookie already cover it */ },
    });
  }

  getLanguage(code: string): AppLanguage | undefined {
    return this.languages.find(l => l.code === code);
  }

  //Called once after login to reconcile device-local choice with the user's saved profile preference
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

  //Priority: localStorage -> cookie -> browser language -> 'en'
  private readInitialLanguage(): string {
    try {
      const saved = localStorage.getItem(STORAGE_KEY);
      if (saved && this.languages.some(l => l.code === saved)) return saved;
    } catch {
    }

    const cookieMatch = document.cookie.match(/(?:^|;\s*)lang=([^;]+)/);
    if (cookieMatch && this.languages.some(l => l.code === cookieMatch[1])) return cookieMatch[1];

    const browserLang = navigator.language?.slice(0, 2);
    if (browserLang && this.languages.some(l => l.code === browserLang)) return browserLang;

    return 'en';
  }
}
