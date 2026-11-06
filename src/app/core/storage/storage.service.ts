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

  /**
   * Liest alle NutriTrack-Schlüssel (ohne Präfix) als geparste JSON-Werte, z. B. für ein Backup.
   * Nicht lesbare Einträge werden ausgelassen (sie wären auch für die Stores unbrauchbar).
   */
  snapshot(): Record<string, unknown> {
    return Object.fromEntries(
      Object.entries(this.rawEntries()).flatMap(([key, raw]) => {
        try {
          return [[key, JSON.parse(raw) as unknown]];
        } catch {
          return [];
        }
      }),
    );
  }

  /**
   * Ersetzt alle NutriTrack-Schlüssel durch `data` (z. B. Backup-Import).
   * Schlägt das Schreiben fehl (Speicher voll), wird der vorherige Stand wiederhergestellt.
   * @returns `true` bei Erfolg.
   */
  replaceAll(data: Readonly<Record<string, unknown>>): boolean {
    const b = this.backend();
    if (!b) return false;
    const previous = this.rawEntries();
    try {
      this.writeRaw(b, previous, {});
      Object.entries(data).forEach(([key, value]) => b.setItem(this.prefix + key, JSON.stringify(value)));
      return true;
    } catch {
      this.restoreRaw(b, previous);
      return false;
    }
  }

  /** Alle NutriTrack-Einträge als Rohstrings (Schlüssel ohne Präfix). */
  private rawEntries(): Record<string, string> {
    const b = this.backend();
    if (!b) return {};
    try {
      const keys = Array.from({ length: b.length }, (_, i) => b.key(i)).filter(
        (k): k is string => !!k && k.startsWith(this.prefix),
      );
      return Object.fromEntries(keys.map((k) => [k.slice(this.prefix.length), b.getItem(k) ?? 'null']));
    } catch {
      return {};
    }
  }

  /** Entfernt alle Schlüssel aus `remove` und schreibt danach `write` (Rohstrings). */
  private writeRaw(b: Storage, remove: Record<string, string>, write: Record<string, string>): void {
    Object.keys(remove).forEach((k) => b.removeItem(this.prefix + k));
    Object.entries(write).forEach(([k, v]) => b.setItem(this.prefix + k, v));
  }

  private restoreRaw(b: Storage, previous: Record<string, string>): void {
    try {
      this.writeRaw(b, this.rawEntries(), previous);
    } catch {
      /* Wiederherstellung fehlgeschlagen — nichts weiter möglich. */
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
