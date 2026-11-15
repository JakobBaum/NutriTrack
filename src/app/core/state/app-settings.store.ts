import { Injectable, inject, signal } from '@angular/core';
import { StorageService } from '../storage/storage.service';
import { DEFAULT_UNIT_SYSTEM, UnitSystem } from '../shopping/units/unit-format';

/** Sprache der App-Inhalte (Rezepte, Zutaten). Zentral, damit weitere Sprachen später ergänzt werden können. */
export type AppLanguage = 'de';
export const APP_LANGUAGE: AppLanguage = 'de';

const KEY_APP_SETTINGS = 'app-settings';

interface StoredAppSettings {
  unitSystem?: unknown;
  fastfoodCountry?: unknown;
}

function parseUnitSystem(raw: unknown): UnitSystem {
  return raw === 'imperial' || raw === 'metric' ? raw : DEFAULT_UNIT_SYSTEM;
}

/**
 * Allgemeine App-Einstellungen (Einheitensystem). Sie sind Teil des Backups. Das Fastfood-Land liegt seit Welle 6 im Profil;
 * ein alter Wert bleibt hier unberührt, bis das Profil ihn übernommen hat.
 */
@Injectable({ providedIn: 'root' })
export class AppSettingsStore {
  private readonly storage = inject(StorageService);

  private readonly stored = this.storage.get<StoredAppSettings>(KEY_APP_SETTINGS, {});
  private readonly _unitSystem = signal<UnitSystem>(parseUnitSystem(this.stored.unitSystem));

  /** Gewähltes Einheitensystem (metrisch ist Standard). */
  readonly unitSystem = this._unitSystem.asReadonly();

  /** Sprache der Inhalte. */
  readonly appLanguage: AppLanguage = APP_LANGUAGE;

  setUnitSystem(system: UnitSystem): void {
    const next = parseUnitSystem(system);
    this._unitSystem.set(next);
    this.persist();
  }

  /** Setzt auf den Standard zurück ("Daten zurücksetzen"). */
  clear(): void {
    this._unitSystem.set(DEFAULT_UNIT_SYSTEM);
    this.storage.remove(KEY_APP_SETTINGS);
  }

  /** Schreibt die Einstellungen und lässt ein noch nicht übernommenes altes Fastfood-Land stehen. */
  private persist(): void {
    const legacy = this.storage.get<StoredAppSettings>(KEY_APP_SETTINGS, {}).fastfoodCountry;
    this.storage.set(KEY_APP_SETTINGS, {
      unitSystem: this._unitSystem(),
      ...(legacy === undefined ? {} : { fastfoodCountry: legacy }),
    });
  }
}
