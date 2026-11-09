import { Injectable, computed, inject, signal } from '@angular/core';
import { AmountUnit, DiaryEntry, DiaryRef, MealType, NutritionFacts } from '../models';
import { StorageService } from '../storage/storage.service';
import { makeId } from '../util/id';
import { sanitizeList } from './record-sanitize';
import type { NewDiaryEntry } from './diary.store';

export const KEY_FAVORITES = 'favorites';

/** Gemerkter Eintrag: Schnappschuss mit Menge und Nährwerten, mit einem Tipp erneut eintragbar. */
export interface FavoriteFood {
  readonly id: string;
  readonly label: string;
  readonly brand?: string;
  readonly ref?: DiaryRef;
  readonly amountG?: number;
  readonly servings?: number;
  readonly unit?: AmountUnit;
  readonly facts: NutritionFacts;
  readonly baseFacts?: NutritionFacts;
  readonly isEstimate?: boolean;
  readonly isPartial?: boolean;
  readonly createdAt: string;
}

type FavoriteSource = Pick<DiaryEntry, 'label' | 'brand'>;

/** Gleichheitsschlüssel: Name und Marke ohne Groß-/Kleinschreibung. */
export function favoriteKey(source: FavoriteSource): string {
  return `${source.label.trim().toLowerCase()}|${(source.brand ?? '').trim().toLowerCase()}`;
}

/** Favorit aus einem Tagebuch-Eintrag (ohne Tag und Essenszeit). */
export function favoriteFromEntry(entry: DiaryEntry, now: string = new Date().toISOString()): FavoriteFood {
  return {
    id: makeId('fav'),
    label: entry.label.trim(),
    brand: entry.brand,
    ref: entry.ref,
    amountG: entry.amountG,
    servings: entry.servings,
    unit: entry.unit,
    facts: entry.facts,
    baseFacts: entry.baseFacts,
    isEstimate: entry.isEstimate,
    isPartial: entry.isPartial,
    createdAt: now,
  };
}

/** Eingabe zum Eintragen eines Favoriten am Tag `dateISO` in der Essenszeit `meal`. */
export function newEntryFromFavorite(fav: FavoriteFood, dateISO: string, meal: MealType): NewDiaryEntry {
  const { id: _id, createdAt: _createdAt, ...rest } = fav;
  return { ...rest, dateISO, meal };
}

function isUsable(raw: unknown): raw is FavoriteFood {
  const f = raw as Partial<FavoriteFood> | null;
  return !!f && typeof f.id === 'string' && typeof f.label === 'string' && f.label.trim() !== '' && !!f.facts && typeof f.facts === 'object';
}

/** Favoriten-Liste (neueste zuerst) mit Schutz gegen beschädigte Daten. */
@Injectable({ providedIn: 'root' })
export class FavoriteStore {
  private readonly storage = inject(StorageService);

  private readonly _favorites = signal<readonly FavoriteFood[]>(
    this.storage.getSanitized<FavoriteFood>(KEY_FAVORITES, (raw) => sanitizeList<FavoriteFood>(raw, isUsable)),
  );

  readonly favorites = this._favorites.asReadonly();
  private readonly keys = computed(() => new Set(this._favorites().map(favoriteKey)));

  isFavorite(source: FavoriteSource): boolean {
    return this.keys().has(favoriteKey(source));
  }

  /** Merkt den Eintrag oder entfernt ihn, wenn er schon Favorit ist. Liefert true, wenn er danach Favorit ist. */
  toggle(entry: DiaryEntry): boolean {
    const key = favoriteKey(entry);
    if (this.keys().has(key)) {
      this._favorites.update((list) => list.filter((f) => favoriteKey(f) !== key));
      this.persist();
      return false;
    }
    this._favorites.update((list) => [favoriteFromEntry(entry), ...list]);
    this.persist();
    return true;
  }

  remove(id: string): void {
    this._favorites.update((list) => list.filter((f) => f.id !== id));
    this.persist();
  }

  clear(): void {
    this._favorites.set([]);
    this.storage.remove(KEY_FAVORITES);
  }

  private persist(): void {
    this.storage.set(KEY_FAVORITES, this._favorites());
  }
}
