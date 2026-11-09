import { Injectable, inject, signal } from '@angular/core';
import { StorageService } from '../storage/storage.service';
import { DEFAULT_UNIT_SYSTEM, UnitSystem } from '../shopping/units/unit-format';

/** Sprache der App-Inhalte (Rezepte, Zutaten). Zentral, damit weitere Sprachen später ergänzt werden können. */
export type AppLanguage = 'de';
export const APP_LANGUAGE: AppLanguage = 'de';

const KEY_APP_SETTINGS = 'app-settings';

interface StoredAppSettings {
  unitSystem?: unknown;
}

function parseUnitSystem(raw: unknown): UnitSystem {
  return raw === 'imperial' || raw === 'metric' ? raw : DEFAULT_UNIT_SYSTEM;
}

/** Allgemeine App-Einstellungen (Einheitensystem). Sie sind Teil des Backups. */
@Injectable({ providedIn: 'root' })
export class AppSettingsStore {
  private readonly storage = inject(StorageService);

  private readonly _unitSystem = signal<UnitSystem>(
    parseUnitSystem(this.storage.get<StoredAppSettings>(KEY_APP_SETTINGS, {}).unitSystem),
  );

  /** Gewähltes Einheitensystem (metrisch ist Standard). */
  readonly unitSystem = this._unitSystem.asReadonly();

  /** Sprache der Inhalte. */
  readonly appLanguage: AppLanguage = APP_LANGUAGE;

  setUnitSystem(system: UnitSystem): void {
    const next = parseUnitSystem(system);
    this._unitSystem.set(next);
    this.storage.set(KEY_APP_SETTINGS, { unitSystem: next });
  }

  /** Setzt auf den Standard zurück ("Daten zurücksetzen"). */
  clear(): void {
    this._unitSystem.set(DEFAULT_UNIT_SYSTEM);
    this.storage.remove(KEY_APP_SETTINGS);
  }
}
