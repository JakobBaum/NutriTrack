import { Injectable, inject, signal } from '@angular/core';
import {
  DailyTarget,
  DiaryEntry,
  DiaryRef,
  AmountUnit,
  MealType,
  NutritionFacts,
} from '../models';
import { NutritionCalcService } from '../nutrition/nutrition-calc.service';
import { StorageService } from '../storage/storage.service';
import { addDaysISO } from '../util/date';
import { makeId } from '../util/id';

const KEY_ENTRIES = 'diary';
/** Wie viele Tage "Wie gestern" / "Tag kopieren" höchstens zurückschaut. */
export const COPY_LOOKBACK_DAYS = 7;
const ISO_DATE_RE = /^\d{4}-\d{2}-\d{2}$/;

/** Ein früherer Tag mit Einträgen als Kopier-Quelle. */
export interface CopySource {
  dateISO: string;
  entries: DiaryEntry[];
}

/**
 * Erzeugt Kopien von Einträgen für einen Zieltag (rein, ohne Seiteneffekte).
 * Neu: id, dateISO, createdAt. Erhalten: Mahlzeit, Name, ref, Nährwerte,
 * Menge/Einheit/Portionen und Flags (isEstimate, isPartial).
 */
export function copyEntriesTo(
  entries: readonly DiaryEntry[],
  dateISO: string,
  nowISO: string = new Date().toISOString(),
  newId: () => string = () => makeId('diary'),
): DiaryEntry[] {
  return entries.map((e) => ({ ...e, id: newId(), dateISO, createdAt: nowISO }));
}

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
  isEstimate?: boolean;
  isPartial?: boolean;
  unit?: AmountUnit;
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
      isEstimate: input.isEstimate,
      isPartial: input.isPartial,
      unit: input.unit,
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
    unit?: AmountUnit;
    /** Neue Bezugswerte pro 100 g/ml (z. B. für manuelle Einträge, die bisher keine hatten). */
    baseFacts?: NutritionFacts;
  }): void {
    // Leere/0/negative Menge nie übernehmen (würde alte oder negative Werte erzeugen).
    const { amountG, baseFacts: patchBase, ...rest } = patch;
    const hasValidAmount = typeof amountG === 'number' && Number.isFinite(amountG) && amountG > 0;
    const validBase = patchBase?.basis === 'per100g' ? patchBase : undefined;
    const safePatch = {
      ...rest,
      ...(hasValidAmount ? { amountG } : {}),
      ...(validBase ? { baseFacts: validBase } : {}),
    };
    this._entries.update((list) =>
      list.map((e) => {
        if (e.id !== id) return e;
        const next = { ...e, ...safePatch };
        const base = next.baseFacts;
        // Nährwerte neu skalieren, wenn Basis und neue Menge bekannt.
        if (base && hasValidAmount && base.basis === 'per100g') {
          const factor = amountG / 100;
          next.facts = {
            ...base,
            kcal: Math.round(base.kcal * factor),
            proteinG: Math.round(base.proteinG * factor * 10) / 10,
            carbsG: Math.round(base.carbsG * factor * 10) / 10,
            fatG: Math.round(base.fatG * factor * 10) / 10,
            fiberG: base.fiberG != null ? Math.round(base.fiberG * factor * 10) / 10 : undefined,
            sugarG: base.sugarG != null ? Math.round(base.sugarG * factor * 10) / 10 : undefined,
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

  /**
   * Kopiert Einträge in den Tag `dateISO` (neue ids/createdAt) und persistiert.
   * Gibt die angelegten Kopien zurück (z. B. für Rückgängig).
   */
  copyEntries(entries: readonly DiaryEntry[], dateISO: string): DiaryEntry[] {
    if (!ISO_DATE_RE.test(dateISO) || entries.length === 0) return [];
    const copies = copyEntriesTo(entries, dateISO);
    this._entries.update((list) => [...list, ...copies]);
    this.persist();
    return copies;
  }

  /** Entfernt mehrere Einträge auf einmal (ein Persist). */
  removeMany(ids: readonly string[]): void {
    if (ids.length === 0) return;
    const drop = new Set(ids);
    this._entries.update((list) => list.filter((e) => !drop.has(e.id)));
    this.persist();
  }

  /**
   * Frühere Tage (neueste zuerst, max. `maxDaysBack` zurück) mit Einträgen,
   * optional nur für eine Mahlzeit.
   */
  copySources(dateISO: string, meal?: MealType, maxDaysBack = COPY_LOOKBACK_DAYS): CopySource[] {
    if (!ISO_DATE_RE.test(dateISO)) return [];
    const sources: CopySource[] = [];
    for (let back = 1; back <= maxDaysBack; back++) {
      const day = addDaysISO(dateISO, -back);
      const entries = meal ? this.entriesForMeal(day, meal) : this.entriesForDate(day);
      if (entries.length > 0) sources.push({ dateISO: day, entries });
    }
    return sources;
  }

  /** Nächstliegender früherer Tag mit Einträgen (für "Wie gestern"), sonst null. */
  findCopySource(dateISO: string, meal?: MealType, maxDaysBack = COPY_LOOKBACK_DAYS): CopySource | null {
    return this.copySources(dateISO, meal, maxDaysBack)[0] ?? null;
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
