import { Injectable, signal } from '@angular/core';

export interface AppTheme {
  id: string;
  name: string;
  /** Swatch color shown in the theme picker (matches --theme-accent for that theme) */
  swatch: string;
}

const STORAGE_KEY = 'luckyshop-theme';

export const APP_THEMES: AppTheme[] = [
  { id: 'indigo',  name: 'Indigo',  swatch: '#4348A0' },
  { id: 'emerald', name: 'Emerald', swatch: '#1C8A63' },
  { id: 'crimson', name: 'Crimson', swatch: '#9B2F42' },
  { id: 'ocean',   name: 'Ocean',   swatch: '#1668A8' },
  { id: 'amber',   name: 'Amber',   swatch: '#B8862E' },
];

@Injectable({ providedIn: 'root' })
export class ThemeService {

  readonly themes = APP_THEMES;

  currentTheme = signal<string>(this.readInitialTheme());

  constructor() {
    this.applyTheme(this.currentTheme());
  }

  setTheme(id: string): void {
    if (!this.themes.some(t => t.id === id)) return;
    this.currentTheme.set(id);
    this.applyTheme(id);
    try {
      localStorage.setItem(STORAGE_KEY, id);
    } catch {
      /* localStorage unavailable — ignore */
    }
  }

  getTheme(id: string): AppTheme | undefined {
    return this.themes.find(t => t.id === id);
  }

  private applyTheme(id: string): void {
    document.documentElement.setAttribute('data-theme', id);
  }

  private readInitialTheme(): string {
    try {
      const saved = localStorage.getItem(STORAGE_KEY);
      if (saved && this.themes.some(t => t.id === saved)) return saved;
    } catch {
      /* localStorage unavailable — ignore */
    }
    return 'indigo';
  }
}
