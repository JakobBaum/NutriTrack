import { Injectable, inject, signal } from '@angular/core';
import { NutritionFacts } from '../models';
import { StorageService } from '../storage/storage.service';
import { makeId } from '../util/id';

const KEY_CUSTOM = 'customFoods';

/** Ein selbst (manuell) eingetragenes Lebensmittel, zur Wiederverwendung. */
export interface CustomFood {
  id: string;
  name: string;
  /** Nährwerte wie erfasst (Basis perPortion). */
  facts: NutritionFacts;
  createdAt: string;
}

/**
 * Speichert manuell eingetragene Lebensmittel offline-first, damit sie bei
 * späteren Tagebuch-Einträgen wiederverwendet werden können. Deduppt nach Name
 * (case-insensitive) — der neueste Eintrag gewinnt und rückt nach oben.
 */
@Injectable({ providedIn: 'root' })
export class CustomFoodStore {
  private readonly storage = inject(StorageService);

  private readonly _foods = signal<CustomFood[]>(
    this.storage.get<CustomFood[]>(KEY_CUSTOM, []),
  );

  /** Alle gespeicherten Lebensmittel, neueste zuerst. */
  readonly foods = this._foods.asReadonly();

  /** Legt ein Lebensmittel an bzw. aktualisiert ein gleichnamiges (immutable). */
  save(name: string, facts: NutritionFacts): void {
    const clean = name.trim();
    if (!clean) return;
    const key = clean.toLowerCase();
    const entry: CustomFood = {
      id: makeId('cfood'),
      name: clean,
      facts: { ...facts },
      createdAt: new Date().toISOString(),
    };
    this._foods.update((list) => [entry, ...list.filter((f) => f.name.toLowerCase() !== key)]);
    this.persist();
  }

  /** Entfernt ein gespeichertes Lebensmittel. */
  remove(id: string): void {
    this._foods.update((list) => list.filter((f) => f.id !== id));
    this.persist();
  }

  /** Löscht alle gespeicherten Lebensmittel (für "Daten zurücksetzen"). */
  clear(): void {
    this._foods.set([]);
    this.persist();
  }

  private persist(): void {
    this.storage.set(KEY_CUSTOM, this._foods());
  }
}
