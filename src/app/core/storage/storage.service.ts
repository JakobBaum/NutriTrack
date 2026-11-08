import { Injectable, OnDestroy, signal } from '@angular/core';

/**
 * Einfache, synchron lesbare Key-Value-Persistenz für das MVP-Gerüst.
 *
 * Nutzt aktuell `localStorage` (funktioniert im Web-Dev-Server sofort, offline-first).
 * Die API ist bewusst schmal gehalten, damit sie später 1:1 gegen Capacitor
 * **Preferences** / SQLite ausgetauscht werden kann, ohne die Stores zu ändern.
 */
@Injectable({ providedIn: 'root' })
export class StorageService implements OnDestroy {
  private readonly prefix = 'nutritrack:';
  /** Schreibzugriffe werden gebündelt (siehe {@link set}); so lange verzögert sich ein Schreiben höchstens. */
  static readonly WRITE_DELAY_MS = 250;
  private readonly pending = new Map<string, unknown>();
  private flushTimer?: ReturnType<typeof setTimeout>;
  private readonly onHide = (): void => this.flush();

  constructor() {
    if (typeof window !== 'undefined') {
      window.addEventListener('pagehide', this.onHide);
      window.addEventListener('beforeunload', this.onHide);
    }
    if (typeof document !== 'undefined') document.addEventListener('visibilitychange', this.onHide);
  }

  ngOnDestroy(): void {
    this.flush();
    if (typeof window !== 'undefined') {
      window.removeEventListener('pagehide', this.onHide);
      window.removeEventListener('beforeunload', this.onHide);
    }
    if (typeof document !== 'undefined') document.removeEventListener('visibilitychange', this.onHide);
  }

  /** Liest einen JSON-Wert; gibt `fallback` zurück, wenn leer oder defekt. */
  get<T>(key: string, fallback: T): T {
    if (this.pending.has(key)) return JSON.parse(JSON.stringify(this.pending.get(key))) as T;
    try {
      const raw = this.backend()?.getItem(this.prefix + key);
      if (raw == null) return fallback;
      return JSON.parse(raw) as T;
    } catch {
      return fallback;
    }
  }

  private readonly _writeFailures = signal(0);
  /** Zähler fehlgeschlagener Schreibzugriffe (Speicher voll/gesperrt); die App meldet jeden neuen Fehler. */
  readonly writeFailures = this._writeFailures.asReadonly();

  /**
   * Schreibt einen JSON-Wert gebündelt: Mehrfach-Schreibzugriffe auf denselben Schlüssel
   * innerhalb von {@link WRITE_DELAY_MS} ergeben einen einzigen `localStorage`-Zugriff.
   * Lesen (`get`, `snapshot`, …) sieht sofort den neuesten Wert; beim Verlassen der Seite
   * (`pagehide`, `visibilitychange`, `beforeunload`) wird sofort geschrieben.
   * Scheitert das Schreiben (Speicher voll/gesperrt), zählt `writeFailures` hoch.
   */
  set<T>(key: string, value: T): void {
    this.pending.set(key, value);
    this.flushTimer ??= setTimeout(() => this.flush(), StorageService.WRITE_DELAY_MS);
  }

  /** Schreibt alle gebündelten Werte sofort. */
  flush(): void {
    clearTimeout(this.flushTimer);
    this.flushTimer = undefined;
    if (this.pending.size === 0) return;
    const entries = Array.from(this.pending);
    this.pending.clear();
    const backend = this.backend();
    for (const [key, value] of entries) {
      try {
        backend?.setItem(this.prefix + key, JSON.stringify(value));
      } catch {
        this._writeFailures.update((n) => n + 1);
      }
    }
  }

  /** Entfernt einen Schlüssel. */
  remove(key: string): void {
    this.pending.delete(key);
    try {
      this.backend()?.removeItem(this.prefix + key);
    } catch {
      /* ignore */
    }
  }

  /** Löscht alle NutriTrack-Schlüssel (für "Daten zurücksetzen"). */
  clearAll(): void {
    this.pending.clear();
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
    this.flush();
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
    this.pending.clear();
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
