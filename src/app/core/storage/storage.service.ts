import { Injectable } from '@angular/core';

/**
 * Einfache, synchron lesbare Key-Value-Persistenz für das MVP-Gerüst.
 *
 * Nutzt aktuell `localStorage` (funktioniert im Web-Dev-Server sofort, offline-first).
 * Die API ist bewusst schmal gehalten, damit sie später 1:1 gegen Capacitor
 * **Preferences** / SQLite ausgetauscht werden kann, ohne die Stores zu ändern.
 */
@Injectable({ providedIn: 'root' })
export class StorageService {
  private readonly prefix = 'nutritrack:';

  /** Liest einen JSON-Wert; gibt `fallback` zurück, wenn leer oder defekt. */
  get<T>(key: string, fallback: T): T {
    try {
      const raw = this.backend()?.getItem(this.prefix + key);
      if (raw == null) return fallback;
      return JSON.parse(raw) as T;
    } catch {
      return fallback;
    }
  }

  /** Schreibt einen JSON-Wert. Fehler werden geschluckt (z.B. privater Modus). */
  set<T>(key: string, value: T): void {
    try {
      this.backend()?.setItem(this.prefix + key, JSON.stringify(value));
    } catch {
      /* Speicher nicht verfügbar — im MVP bewusst tolerant. */
    }
  }

  /** Entfernt einen Schlüssel. */
  remove(key: string): void {
    try {
      this.backend()?.removeItem(this.prefix + key);
    } catch {
      /* ignore */
    }
  }

  /** Löscht alle NutriTrack-Schlüssel (für "Daten zurücksetzen"). */
  clearAll(): void {
    const b = this.backend();
    if (!b) return;
    try {
      const keys: string[] = [];
      for (let i = 0; i < b.length; i++) {
        const k = b.key(i);
        if (k && k.startsWith(this.prefix)) keys.push(k);
      }
      keys.forEach((k) => b.removeItem(k));
    } catch {
      /* ignore */
    }
  }

  private backend(): Storage | null {
    try {
      return typeof localStorage !== 'undefined' ? localStorage : null;
    } catch {
      return null;
    }
  }
}
