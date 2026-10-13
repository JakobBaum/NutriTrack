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
      createdAt: new Date().toISOString(),
    };
    this._entries.update((list) => [...list, entry]);
    this.persist();
    return entry;
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

  /** Löscht alle Einträge (für "Daten zurücksetzen"). */
  clear(): void {
    this._entries.set([]);
    this.persist();
  }

  private persist(): void {
    this.storage.set(KEY_ENTRIES, this._entries());
  }
}
