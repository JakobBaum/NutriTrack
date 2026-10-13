import { Injectable, computed, inject, signal } from '@angular/core';
import { DailyTarget, UserProfile } from '../models';
import { NutritionCalcService } from '../nutrition/nutrition-calc.service';
import { StorageService } from '../storage/storage.service';

const KEY_PROFILE = 'profile';

/**
 * Hält das Nutzerprofil und das daraus abgeleitete Tagesziel (Kalorien + Makros).
 * Das Ziel wird deterministisch über den {@link NutritionCalcService} berechnet
 * (KI-Anbieter kann es später überschreiben) und lokal persistiert.
 */
@Injectable({ providedIn: 'root' })
export class ProfileStore {
  private readonly storage = inject(StorageService);
  private readonly calc = inject(NutritionCalcService);

  private readonly _profile = signal<UserProfile | null>(
    this.storage.get<UserProfile | null>(KEY_PROFILE, null),
  );

  /** Aktuelles Profil (oder null, wenn noch kein Onboarding erfolgt ist). */
  readonly profile = this._profile.asReadonly();

  /** Abgeleitetes Tagesziel — null, solange kein Profil vorhanden ist. */
  readonly target = computed<DailyTarget | null>(() => {
    const p = this._profile();
    return p ? this.calc.dailyTarget(p) : null;
  });

  /** True, sobald ein Profil gespeichert wurde. */
  readonly hasProfile = computed(() => this._profile() !== null);

  /** Speichert ein neues/aktualisiertes Profil und persistiert es. */
  setProfile(profile: UserProfile): void {
    const next: UserProfile = { ...profile, updatedAt: new Date().toISOString() };
    this._profile.set(next);
    this.storage.set(KEY_PROFILE, next);
  }

  /** Setzt das Profil zurück (für "Daten zurücksetzen"). */
  clear(): void {
    this._profile.set(null);
    this.storage.remove(KEY_PROFILE);
  }
}
