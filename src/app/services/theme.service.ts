import { Injectable } from '@angular/core';
import { StorageService } from './storage.service';

@Injectable({ providedIn: 'root' })
export class ThemeService {

  constructor(private storage: StorageService) {}

  init() {
    this.apply(this.storage.getAccentColor());
  }

  apply(color: string) {
    const r = document.documentElement;
    r.style.setProperty('--t-accent', color);
    r.style.setProperty('--ion-color-primary', color);
    r.style.setProperty('--ion-color-primary-shade', this.shade(color, -15));
    r.style.setProperty('--ion-color-primary-tint',  this.shade(color,  15));
  }

  private shade(hex: string, pct: number): string {
    const n = parseInt(hex.replace('#', ''), 16);
    const r = Math.min(255, Math.max(0, (n >> 16)        + Math.round(2.55 * pct)));
    const g = Math.min(255, Math.max(0, ((n >> 8) & 0xff) + Math.round(2.55 * pct)));
    const b = Math.min(255, Math.max(0, (n & 0xff)        + Math.round(2.55 * pct)));
    return `#${((1 << 24) | (r << 16) | (g << 8) | b).toString(16).slice(1)}`;
  }
}
