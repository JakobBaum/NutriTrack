import { Injectable, computed, inject, signal } from '@angular/core';
import { DailyTarget, UserProfile } from '../models';
import { NutritionCalcService } from '../nutrition/nutrition-calc.service';
import { StorageService } from '../storage/storage.service';
import { DEFAULT_FASTFOOD_COUNTRY } from '../ai/fastfood-countries';
import { legacyFastfoodCountry, sanitizeProfile, withLegacyFastfoodCountry } from './profile-sanitize';

const KEY_PROFILE = 'profile';
const KEY_APP_SETTINGS = 'app-settings';

/**
 * Hält das Nutzerprofil und das daraus abgeleitete Tagesziel (Kalorien + Makros).
 * Das Ziel wird deterministisch über den {@link NutritionCalcService} berechnet
 * (KI-Anbieter kann es später überschreiben) und lokal persistiert.
 */
@Injectable({ providedIn: 'root' })
export class ProfileStore {
  private readonly storage = inject(StorageService);
  private readonly calc = inject(NutritionCalcService);

  /** Altes Fastfood-Land aus den App-Einstellungen (nur zur einmaligen Übernahme ins Profil). */
  private readonly legacyCountryRaw = this.storage.get<{ fastfoodCountry?: unknown }>(KEY_APP_SETTINGS, {}).fastfoodCountry;
  private readonly _profile = signal<UserProfile | null>(this.load());

  /** Aktuelles Profil (oder null, wenn noch kein Onboarding erfolgt ist). */
  readonly profile = this._profile.asReadonly();

  /** Abgeleitetes Tagesziel — null, solange kein Profil vorhanden ist. */
  readonly target = computed<DailyTarget | null>(() => {
    const p = this._profile();
    return p ? this.calc.dailyTarget(p) : null;
  });

  /** Land für den Fastfood-Helfer: Profil, sonst ein noch nicht übernommener alter Wert, sonst Österreich. */
  readonly fastfoodCountry = computed(
    () => this._profile()?.fastfoodCountry ?? legacyFastfoodCountry(this.legacyCountryRaw) ?? DEFAULT_FASTFOOD_COUNTRY,
  );

  /** True, sobald ein Profil gespeichert wurde. */
  readonly hasProfile = computed(() => this._profile() !== null);

  /** Speichert ein neues/aktualisiertes Profil und persistiert es. */
  setProfile(profile: UserProfile): void {
    const next: UserProfile = { ...profile, updatedAt: new Date().toISOString() };
    this._profile.set(next);
    this.storage.set(KEY_PROFILE, next);
  }

  /**
   * Liest das Profil und prüft es (Typen, Wertebereiche, Ernährungsangaben). Ein unbrauchbares Profil
   * wird in Quarantäne gesichert und entfernt, damit die App nie mit kaputten Werten rechnet.
   */
  private load(): UserProfile | null {
    const stored = this.storage.get<unknown>(KEY_PROFILE, null);
    if (stored === null) return null;
    const clean = sanitizeProfile(stored);
    if (clean === null) {
      this.storage.quarantine(KEY_PROFILE, [stored], 'invalid');
      this.storage.remove(KEY_PROFILE);
    }
    return clean === null ? null : this.adoptLegacyCountry(clean);
  }

  /** Übernimmt ein altes Fastfood-Land einmalig ins Profil und speichert es. */
  private adoptLegacyCountry(profile: UserProfile): UserProfile {
    if (this.storage.schemaNewer()) return profile;
    const adopted = withLegacyFastfoodCountry(profile, this.legacyCountryRaw);
    if (adopted !== profile) this.storage.set(KEY_PROFILE, adopted);
    return adopted;
  }

  /** Setzt das Profil zurück (für "Daten zurücksetzen"). */
  clear(): void {
    this._profile.set(null);
    this.storage.remove(KEY_PROFILE);
  }
}
