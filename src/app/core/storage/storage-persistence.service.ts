import { Injectable, signal } from '@angular/core';

/**
 * Bittet den Browser um dauerhaften Speicher (`navigator.storage.persist()`), damit das
 * System die Daten nicht bei Speicherdruck löscht. Eine Ablehnung wird protokolliert
 * und für den Backup-Hinweis vermerkt.
 */
@Injectable({ providedIn: 'root' })
export class StoragePersistenceService {
  private readonly _denied = signal(false);
  readonly denied = this._denied.asReadonly();

  async request(): Promise<boolean> {
    const storage = typeof navigator === 'undefined' ? undefined : navigator.storage;
    if (!storage?.persist) return true;
    try {
      if (storage.persisted && (await storage.persisted())) return true;
      const granted = await storage.persist();
      if (!granted) {
        console.warn('NutriTrack: Dauerhafter Speicher wurde nicht gewährt; Daten können vom System gelöscht werden.');
        this._denied.set(true);
      }
      return granted;
    } catch (e) {
      console.error('NutriTrack: navigator.storage.persist() fehlgeschlagen', e);
      this._denied.set(true);
      return false;
    }
  }
}
