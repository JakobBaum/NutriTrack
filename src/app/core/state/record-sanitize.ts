/**
 * Reine Bereinigung geladener Datensätze (Rolle 13 F4). Nichts wirft, nichts wird verändert:
 * Felder, die sich sicher ableiten lassen, werden repariert; Datensätze, die sonst Nährwerte
 * oder den Tag erfinden müssten, landen in `rejected` (die Aufrufer legen sie in Quarantäne).
 */
import { DiaryEntry, MealType, NutritionFacts } from '../models';
import { makeId } from '../util/id';
import { toDateISO } from '../util/date';

type Rec = Record<string, unknown>;

export interface SanitizeResult<T> {
  /** Verwendbare (ggf. reparierte) Datensätze. */
  readonly items: readonly T[];
  /** Verworfene Roh-Datensätze, unverändert. */
  readonly rejected: readonly unknown[];
  /** Anzahl reparierter Datensätze. */
  readonly repaired: number;
}

const MEALS: ReadonlySet<string> = new Set(['breakfast', 'lunch', 'dinner', 'snack']);
const ISO_DAY = /^\d{4}-\d{2}-\d{2}$/;
const FALLBACK_LABEL = 'Eintrag';
const FALLBACK_MEAL: MealType = 'snack';
const NOON_HOUR = 12;

const isRec = (v: unknown): v is Rec => typeof v === 'object' && v !== null && !Array.isArray(v);
const isStr = (v: unknown): v is string => typeof v === 'string';
const isNonNegative = (v: unknown): v is number => typeof v === 'number' && Number.isFinite(v) && v >= 0;
const isPositive = (v: unknown): v is number => typeof v === 'number' && Number.isFinite(v) && v > 0;
const isValidDate = (v: unknown): v is string => isStr(v) && v !== '' && !Number.isNaN(Date.parse(v));
const isValidDay = (v: unknown): v is string => isStr(v) && ISO_DAY.test(v) && !Number.isNaN(Date.parse(v));

/** Ohne `undefined`-Werte kopieren (damit JSON und Vergleiche sauber bleiben). */
const compact = <T extends Rec>(obj: T): T =>
  Object.fromEntries(Object.entries(obj).filter(([, v]) => v !== undefined)) as T;

/** Pflichtwerte müssen endlich und nicht negativ sein, sonst null; optionale ungültige Werte entfallen. */
function cleanFacts(raw: unknown): NutritionFacts | null {
  if (!isRec(raw)) return null;
  const { kcal, proteinG, carbsG, fatG } = raw;
  if (![kcal, proteinG, carbsG, fatG].every(isNonNegative)) return null;
  const optional = (v: unknown): number | undefined => (isNonNegative(v) ? v : undefined);
  return compact({
    ...raw,
    kcal,
    proteinG,
    carbsG,
    fatG,
    fiberG: optional(raw['fiberG']),
    sugarG: optional(raw['sugarG']),
    saltG: optional(raw['saltG']),
  }) as unknown as NutritionFacts;
}

/** Lokaler Tag (YYYY-MM-DD) eines ISO-Zeitpunkts. */
const dayOf = (iso: string): string => toDateISO(new Date(iso));

/** Mittag lokal des Tages als ISO-Zeitpunkt. */
function noonOf(day: string): string {
  const [y, m, d] = day.split('-').map(Number);
  return new Date(y, m - 1, d, NOON_HOUR).toISOString();
}

interface Cleaned {
  readonly entry: DiaryEntry;
  readonly repaired: boolean;
}

function cleanEntry(raw: Rec, usedIds: ReadonlySet<string>): Cleaned | null {
  const facts = cleanFacts(raw['facts']);
  if (!facts) return null;
  let repaired = false;
  const fix = <T>(value: T, ok: boolean, fallback: T): T => {
    if (!ok) repaired = true;
    return ok ? value : fallback;
  };

  const rawDay = raw['dateISO'];
  const rawCreated = raw['createdAt'];
  const day = isValidDay(rawDay) ? rawDay : isValidDate(rawCreated) ? dayOf(rawCreated) : null;
  if (!day) return null;
  const idOk = isStr(raw['id']) && raw['id'] !== '' && !usedIds.has(raw['id']);
  const label = isStr(raw['label']) && raw['label'].trim() !== '' ? raw['label'] : null;
  const ref = isRec(raw['ref']) && isStr(raw['ref']['kind']) ? (raw['ref'] as unknown as DiaryEntry['ref']) : null;
  const amount = raw['amountG'];
  const servings = raw['servings'];
  if (!isValidDay(rawDay)) repaired = true;

  const entry = compact({
    ...raw,
    id: fix(raw['id'] as string, idOk, makeId('diary')),
    dateISO: day,
    meal: fix(raw['meal'] as MealType, isStr(raw['meal']) && MEALS.has(raw['meal']), FALLBACK_MEAL),
    label: fix(label as string, label !== null, FALLBACK_LABEL),
    ref: fix(ref as DiaryEntry['ref'], ref !== null, { kind: 'manual' } as DiaryEntry['ref']),
    facts,
    amountG: fix(amount as number | undefined, amount === undefined || amount === null || isPositive(amount), undefined),
    servings: fix(servings as number | undefined, servings === undefined || servings === null || isPositive(servings), undefined),
    createdAt: fix(rawCreated as string, isValidDate(rawCreated), noonOf(day)),
  }) as unknown as DiaryEntry;
  return { entry, repaired };
}

/** Bereinigt die gespeicherte Tagebuch-Liste (Laden, Import, Wiederherstellen). */
export function sanitizeDiaryEntries(raw: unknown): SanitizeResult<DiaryEntry> {
  if (!Array.isArray(raw)) return notAList(raw);
  const items: DiaryEntry[] = [];
  const rejected: unknown[] = [];
  const usedIds = new Set<string>();
  let repaired = 0;
  for (const rec of raw) {
    const cleaned = isRec(rec) ? cleanEntry(rec, usedIds) : null;
    if (!cleaned) {
      rejected.push(rec);
      continue;
    }
    usedIds.add(cleaned.entry.id);
    items.push(cleaned.entry);
    if (cleaned.repaired) repaired++;
  }
  return { items, rejected, repaired };
}

/** Allgemeine Liste: gültige Datensätze (laut `check`) bleiben, alle anderen werden verworfen. */
export function sanitizeList<T>(raw: unknown, check: (v: unknown) => boolean): SanitizeResult<T> {
  if (!Array.isArray(raw)) return notAList(raw);
  const items = raw.filter(check) as T[];
  const rejected = raw.filter((v) => !check(v));
  return { items, rejected, repaired: 0 };
}

/** Kein Array: leer/fehlend ist normal; jeder andere Wert wird als Ganzes verworfen (nie still überschreiben). */
function notAList<T>(raw: unknown): SanitizeResult<T> {
  const missing = raw === null || raw === undefined;
  return { items: [], rejected: missing ? [] : [raw], repaired: 0 };
}
