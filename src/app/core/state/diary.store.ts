import { Injectable, inject, signal } from '@angular/core';
import {
  DailyTarget,
  DiaryEntry,
  DiaryRef,
  MealType,
  NutritionFacts,
} from '../models';
import { NutritionCalcService } from '../nutrition/nutrition-calc.service';
import { StorageService } from '../storage/storage.service';
import { makeId } from '../util/id';

const KEY_ENTRIES = 'diary';

/** Eingabe-DTO zum Anlegen eines Tagebuch-Eintrags. */
export interface NewDiaryEntry {
  dateISO: string;
  meal: MealType;
  label: string;
  facts: NutritionFacts;
  ref?: DiaryRef;
  amountG?: number;
  servings?: number;
  /** Basis-Nährwerte vor Mengenskalierung (per100g) — für spätere Neuskalierung. */
  baseFacts?: NutritionFacts;
}

/**
 * Verwaltet die verzehrten Posten (Tagebuch) offline-first.
 * Aggregationen (Tagessumme, Summe je Mahlzeit) laufen über den
 * {@link NutritionCalcService}, damit die Rechenlogik zentral bleibt.
 */
@Injectable({ providedIn: 'root' })
export class DiaryStore {
  private readonly storage = inject(StorageService);
  private readonly calc = inject(NutritionCalcService);

  private readonly _entries = signal<DiaryEntry[]>(
    this.storage.get<DiaryEntry[]>(KEY_ENTRIES, []),
  );

  /** Alle Einträge (unsortiert). */
  readonly entries = this._entries.asReadonly();

  /** Legt einen neuen Eintrag an und persistiert ihn. */
  add(input: NewDiaryEntry): DiaryEntry {
    const entry: DiaryEntry = {
      id: makeId('diary'),
      dateISO: input.dateISO,
      meal: input.meal,
      label: input.label,
      ref: input.ref ?? { kind: 'manual' },
      amountG: input.amountG,
      servings: input.servings,
      facts: input.facts,
      baseFacts: input.baseFacts,
      createdAt: new Date().toISOString(),
    };
    this._entries.update((list) => [...list, entry]);
    this.persist();
    return entry;
  }

  /** Aktualisiert Name, Mahlzeit, Menge und skaliert Nährwerte neu (wenn baseFacts vorhanden). */
  update(id: string, patch: {
    label?: string;
    meal?: MealType;
    amountG?: number;
    servings?: number;
  }): void {
    this._entries.update((list) =>
      list.map((e) => {
        if (e.id !== id) return e;
        const next = { ...e, ...patch };
        // Nährwerte neu skalieren, wenn Basis und neue Menge bekannt.
        if (e.baseFacts && patch.amountG != null && e.baseFacts.basis === 'per100g') {
          const factor = patch.amountG / 100;
          next.facts = {
            ...e.baseFacts,
            kcal: Math.round(e.baseFacts.kcal * factor),
            proteinG: Math.round(e.baseFacts.proteinG * factor * 10) / 10,
            carbsG: Math.round(e.baseFacts.carbsG * factor * 10) / 10,
            fatG: Math.round(e.baseFacts.fatG * factor * 10) / 10,
            fiberG: e.baseFacts.fiberG != null ? Math.round(e.baseFacts.fiberG * factor * 10) / 10 : undefined,
            sugarG: e.baseFacts.sugarG != null ? Math.round(e.baseFacts.sugarG * factor * 10) / 10 : undefined,
            basis: 'perPortion',
          };
        }
        return next;
      }),
    );
    this.persist();
  }

  /** Entfernt einen Eintrag. */
  remove(id: string): void {
    this._entries.update((list) => list.filter((e) => e.id !== id));
    this.persist();
  }

  /** Einträge eines Tages, nach Erstellzeit sortiert. */
  entriesForDate(dateISO: string): DiaryEntry[] {
    return this._entries()
      .filter((e) => e.dateISO === dateISO)
      .sort((a, b) => a.createdAt.localeCompare(b.createdAt));
  }

  /** Einträge eines Tages für eine bestimmte Mahlzeit. */
  entriesForMeal(dateISO: string, meal: MealType): DiaryEntry[] {
    return this.entriesForDate(dateISO).filter((e) => e.meal === meal);
  }

  /** Summierte Nährwerte eines Tages. */
  totalsForDate(dateISO: string): DailyTarget {
    return this.calc.sum(this.entriesForDate(dateISO).map((e) => e.facts));
  }

  /** Summierte Kalorien einer Mahlzeit an einem Tag. */
  kcalForMeal(dateISO: string, meal: MealType): number {
    return this.entriesForMeal(dateISO, meal).reduce(
      (sum, e) => sum + (e.facts.kcal || 0),
      0,
    );
  }

  /**
   * Letzte `limit` eindeutige Lebensmittel-Einträge (manuelle + Food/Barcode),
   * sortiert nach Erstell-Datum absteigend. Rezepte werden ausgelassen.
   */
  recentFoods(limit = 5): DiaryEntry[] {
    const seen = new Set<string>();
    return [...this._entries()]
      .sort((a, b) => b.createdAt.localeCompare(a.createdAt))
      .filter((e) => {
        if (e.ref?.kind === 'recipe') return false;
        if (seen.has(e.label)) return false;
        seen.add(e.label);
        return true;
      })
      .slice(0, limit);
  }

  /**
   * Letzte `limit` eindeutige Rezept-IDs aus Tagebuch-Einträgen,
   * neueste zuerst.
   */
  recentRecipeIds(limit = 3): string[] {
    const seen = new Set<string>();
    const ids: string[] = [];
    for (const e of [...this._entries()].sort((a, b) =>
      b.createdAt.localeCompare(a.createdAt),
    )) {
      if (e.ref?.kind === 'recipe' && e.ref.recipeId && !seen.has(e.ref.recipeId)) {
        seen.add(e.ref.recipeId);
        ids.push(e.ref.recipeId);
        if (ids.length >= limit) break;
      }
    }
    return ids;
  }

  /** Löscht alle Einträge (für "Daten zurücksetzen"). */
  clear(): void {
    this._entries.set([]);
    this.persist();
  }

  private persist(): void {
    this.storage.set(KEY_ENTRIES, this._entries());
  }
}
