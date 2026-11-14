import { Injectable, inject, signal } from '@angular/core';
import { StorageService } from '../storage/storage.service';
import { DEFAULT_UNIT_SYSTEM, UnitSystem } from '../shopping/units/unit-format';
import { DEFAULT_FASTFOOD_COUNTRY, parseFastfoodCountry } from '../ai/fastfood-countries';

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

/** Allgemeine App-Einstellungen (Einheitensystem, Fastfood-Land). Sie sind Teil des Backups. */
@Injectable({ providedIn: 'root' })
export class AppSettingsStore {
  private readonly storage = inject(StorageService);

  private readonly stored = this.storage.get<StoredAppSettings>(KEY_APP_SETTINGS, {});
  private readonly _unitSystem = signal<UnitSystem>(parseUnitSystem(this.stored.unitSystem));
  private readonly _fastfoodCountry = signal<string>(parseFastfoodCountry(this.stored.fastfoodCountry));

  /** Gewähltes Einheitensystem (metrisch ist Standard). */
  readonly unitSystem = this._unitSystem.asReadonly();

  /** Land für den Fastfood-Helfer (Sortiment); Vorgabe Österreich. */
  readonly fastfoodCountry = this._fastfoodCountry.asReadonly();

  /** Sprache der Inhalte. */
  readonly appLanguage: AppLanguage = APP_LANGUAGE;

  setUnitSystem(system: UnitSystem): void {
    const next = parseUnitSystem(system);
    this._unitSystem.set(next);
    this.persist();
  }

  /** Setzt das Fastfood-Land; unbekannte Werte werden ignoriert. */
  setFastfoodCountry(country: string): void {
    if (parseFastfoodCountry(country) !== country) return;
    this._fastfoodCountry.set(country);
    this.persist();
  }

  /** Setzt auf den Standard zurück ("Daten zurücksetzen"). */
  clear(): void {
    this._unitSystem.set(DEFAULT_UNIT_SYSTEM);
    this._fastfoodCountry.set(DEFAULT_FASTFOOD_COUNTRY);
    this.storage.remove(KEY_APP_SETTINGS);
  }

  /** Schreibt beide Einstellungen; das Land nur, wenn es von der Vorgabe abweicht. */
  private persist(): void {
    const country = this._fastfoodCountry();
    this.storage.set(KEY_APP_SETTINGS, {
      unitSystem: this._unitSystem(),
      ...(country === DEFAULT_FASTFOOD_COUNTRY ? {} : { fastfoodCountry: country }),
    });
  }
}
