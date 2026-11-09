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
import { addDaysISO, toDateISO } from '../util/date';
import { makeId } from '../util/id';
import { sanitizeDiaryEntries } from './record-sanitize';

const KEY_ENTRIES = 'diary';
/** Wie viele Tage "Wie gestern" / "Tag kopieren" höchstens zurückschaut. */
export const COPY_LOOKBACK_DAYS = 7;
const ISO_DATE_RE = /^\d{4}-\d{2}-\d{2}$/;
const VALID_MEALS: ReadonlySet<string> = new Set(['breakfast', 'lunch', 'dinner', 'snack']);
const DEFAULT_LABEL = 'Eintrag';
/** Zeitfenster (Tage), in dem "Zuletzt benutzt" nach Essenszeit zählt. */
const RECENT_WINDOW_DAYS = 30;
const MS_PER_DAY = 86_400_000;

/** Identität eines Lebensmittels in "Zuletzt benutzt": Name und Marke, ohne Groß-/Kleinschreibung. */
const foodKey = (e: DiaryEntry): string => `${e.label.trim().toLowerCase()}|${(e.brand ?? '').trim().toLowerCase()}`;

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

const isPositiveNumber = (v: unknown): v is number => typeof v === 'number' && Number.isFinite(v) && v > 0;
const validAmountOrUndefined = (v: number | undefined): number | undefined => (isPositiveNumber(v) ? v : undefined);
const safeNonNegative = (v: number): number => (typeof v === 'number' && Number.isFinite(v) && v >= 0 ? v : 0);
const safeOptional = (v: number | undefined): number | undefined =>
  typeof v === 'number' && Number.isFinite(v) && v >= 0 ? v : undefined;

/** Ersetzt nicht endliche/negative Nährwerte (Pflichtfelder 0, optionale weggelassen). */
function sanitizeFacts(f: NutritionFacts): NutritionFacts {
  return {
    ...f,
    kcal: safeNonNegative(f.kcal),
    proteinG: safeNonNegative(f.proteinG),
    carbsG: safeNonNegative(f.carbsG),
    fatG: safeNonNegative(f.fatG),
    fiberG: safeOptional(f.fiberG),
    sugarG: safeOptional(f.sugarG),
    saltG: safeOptional(f.saltG),
  };
}

const entrySignature = (e: DiaryEntry): string =>
  [e.meal, e.label.trim().toLowerCase(), e.amountG ?? '', e.servings ?? '', e.unit ?? '', Math.round(e.facts.kcal)].join('|');

/** Quell-Einträge, die am Ziel noch nicht (in gleicher Anzahl) vorhanden sind (Schutz vor doppeltem Kopieren). */
function withoutExisting(source: readonly DiaryEntry[], existing: readonly DiaryEntry[]): DiaryEntry[] {
  const counts = new Map<string, number>();
  existing.forEach((e) => counts.set(entrySignature(e), (counts.get(entrySignature(e)) ?? 0) + 1));
  return source.filter((e) => {
    const sig = entrySignature(e);
    const left = counts.get(sig) ?? 0;
    if (left <= 0) return true;
    counts.set(sig, left - 1);
    return false;
  });
}

/** Eingabe-DTO zum Anlegen eines Tagebuch-Eintrags. */
export interface NewDiaryEntry {
  dateISO: string;
  meal: MealType;
  label: string;
  brand?: string;
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
    this.storage.getSanitized<DiaryEntry>(KEY_ENTRIES, sanitizeDiaryEntries),
  );

  /** Alle Einträge (unsortiert). */
  readonly entries = this._entries.asReadonly();

  /** Legt einen neuen Eintrag an und persistiert ihn. Ungültige Mengen und Nährwerte werden bereinigt. */
  add(input: NewDiaryEntry): DiaryEntry {
    const entry: DiaryEntry = {
      id: makeId('diary'),
      dateISO: ISO_DATE_RE.test(input.dateISO) ? input.dateISO : toDateISO(),
      meal: VALID_MEALS.has(input.meal) ? input.meal : 'snack',
      label: typeof input.label === 'string' && input.label.trim() !== '' ? input.label : DEFAULT_LABEL,
      brand: input.brand,
      ref: input.ref ?? { kind: 'manual' },
      amountG: validAmountOrUndefined(input.amountG),
      servings: validAmountOrUndefined(input.servings),
      facts: sanitizeFacts(input.facts),
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
    /** Neue Gesamt-Nährwerte (z. B. nach Portionsänderung); id, createdAt und Reihenfolge bleiben. */
    facts?: NutritionFacts;
    /** Neue Bezugswerte pro 100 g/ml (z. B. für manuelle Einträge, die bisher keine hatten). */
    baseFacts?: NutritionFacts;
    /** Entfernt die (rein informative) Menge samt Einheit; Nährwerte bleiben unverändert. */
    clearAmount?: boolean;
  }): void {
    // Leere/0/negative Menge nie übernehmen (würde alte oder negative Werte erzeugen).
    const { amountG, baseFacts: patchBase, label, clearAmount, ...rest } = patch;
    const cleanLabel = label?.trim();
    const hasValidAmount = typeof amountG === 'number' && Number.isFinite(amountG) && amountG > 0;
    const validBase = patchBase?.basis === 'per100g' ? patchBase : undefined;
    const safePatch = {
      ...rest,
      ...(cleanLabel ? { label: cleanLabel } : {}),
      ...(clearAmount && !hasValidAmount ? { amountG: undefined, unit: undefined } : {}),
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
            saltG: base.saltG != null ? Math.round(base.saltG * factor * 100) / 100 : undefined,
            basis: 'perPortion',
          };
        }
        return next;
      }),
    );
    this.persist();
  }

  /** Listenposition eines Eintrags (-1, wenn unbekannt); für Rückgängig nach dem Löschen. */
  indexOf(id: string): number {
    return this._entries().findIndex((e) => e.id === id);
  }

  /** Entfernt einen Eintrag. */
  remove(id: string): void {
    this._entries.update((list) => list.filter((e) => e.id !== id));
    this.persist();
  }

  /**
   * Legt einen gelöschten Eintrag mit alter Id und (wenn bekannt) an alter Listenposition wieder an.
   * Liefert false, wenn die Id schon existiert (z. B. doppeltes Rückgängig).
   */
  restore(entry: DiaryEntry, index?: number): boolean {
    if (this._entries().some((e) => e.id === entry.id)) return false;
    const [clean] = sanitizeDiaryEntries([entry]).items;
    if (!clean) return false;
    this._entries.update((list) => {
      const at = index === undefined ? list.length : Math.min(Math.max(0, index), list.length);
      return [...list.slice(0, at), clean, ...list.slice(at)];
    });
    this.persist();
    return true;
  }

  /**
   * Kopiert Einträge in den Tag `dateISO` (neue ids/createdAt) und persistiert.
   * Gibt die angelegten Kopien zurück (z. B. für Rückgängig).
   */
  copyEntries(entries: readonly DiaryEntry[], dateISO: string): DiaryEntry[] {
    if (!ISO_DATE_RE.test(dateISO) || entries.length === 0) return [];
    const copies = copyEntriesTo(withoutExisting(entries, this.entriesForDate(dateISO)), dateISO);
    if (copies.length === 0) return [];
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
   * Letzte `limit` eindeutige Lebensmittel-Einträge (manuell + Food/Barcode); Rezepte entfallen.
   * Mit `meal`: zuerst Lebensmittel dieser Essenszeit nach Häufigkeit der letzten 30 Tage
   * (bei Gleichstand das jüngste), danach der Rest nach Aktualität. Eindeutig nach Name und Marke.
   */
  recentFoods(limit = 5, meal?: MealType, now: Date = new Date()): DiaryEntry[] {
    const newestFirst = [...this._entries()]
      .filter((e) => e.ref?.kind !== 'recipe')
      .sort((a, b) => b.createdAt.localeCompare(a.createdAt));
    const unique = (list: readonly DiaryEntry[]): DiaryEntry[] => {
      const seen = new Set<string>();
      return list.filter((e) => {
        const key = foodKey(e);
        if (seen.has(key)) return false;
        seen.add(key);
        return true;
      });
    };
    if (!meal) return unique(newestFirst).slice(0, limit);

    const since = new Date(now.getTime() - RECENT_WINDOW_DAYS * MS_PER_DAY).toISOString();
    const counts = new Map<string, number>();
    newestFirst
      .filter((e) => e.meal === meal && e.createdAt >= since)
      .forEach((e) => counts.set(foodKey(e), (counts.get(foodKey(e)) ?? 0) + 1));
    const ofMeal = unique(newestFirst.filter((e) => e.meal === meal));
    // Array.sort ist stabil: bei gleicher Häufigkeit bleibt die Reihenfolge nach Aktualität.
    const ranked = [...ofMeal].sort((a, b) => (counts.get(foodKey(b)) ?? 0) - (counts.get(foodKey(a)) ?? 0));
    return unique([...ranked, ...newestFirst]).slice(0, limit);
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
