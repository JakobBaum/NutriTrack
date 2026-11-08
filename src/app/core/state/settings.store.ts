import { Injectable, inject } from '@angular/core';
import { StorageService } from '../storage/storage.service';
import { RecipeSearchConfigStore } from './recipe-search-config.store';

/** Frühere Speicherschlüssel der KI-Verbindung (eigener Key, Server-Adresse, Modell). */
const LEGACY_KEY_AI = 'ai-config';

/**
 * Die KI-Verbindung ist nur noch global (Worker aus der Umgebung) und nicht mehr einstellbar.
 * Beim Start werden alte, lokal gespeicherte KI-Verbindungsdaten (eigener Gemini-Key,
 * Server-Adresse, Modell) verworfen, damit kein Schlüssel auf dem Gerät zurückbleibt.
 */
@Injectable({ providedIn: 'root' })
export class SettingsStore {
  private readonly storage = inject(StorageService);
  private readonly recipeSearch = inject(RecipeSearchConfigStore);

  constructor() {
    this.storage.remove(LEGACY_KEY_AI);
  }

  /** Setzt die Einstellungen zurück (Rezept-Suche-Konfiguration inklusive). */
  clear(): void {
    this.storage.remove(LEGACY_KEY_AI);
    this.recipeSearch.clear();
  }
}
