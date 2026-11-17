/**
 * Bereinigung der Datensätze eines Backups beim Import (Rolle 13 F4/F12): Ein einzelner defekter
 * Datensatz lehnt das Backup nicht mehr ab. Reparierbares wird repariert, der Rest kommt in Quarantäne.
 * Rein, ohne Browser-Abhängigkeit.
 */
import { sanitizeDiaryEntries, sanitizeList } from '../state/record-sanitize';
import { sanitizeFavorites } from '../state/favorite-sanitize';
import { sanitizeShoppingList } from '../state/shopping-sanitize';
import { sanitizeWeightEntries } from '../state/weight-sanitize';
import { Rec } from '../util/guards';
import { sanitizeRecipes } from '../state/recipe-sanitize';
import { sanitizeProfile } from '../state/profile-sanitize';
import { sanitizeBlocked, sanitizeWeekPlan } from '../state/week-plan-sanitize';
import { ARRAY_CHECKS } from './backup-records';

export interface BackupSanitizeResult {
  /** Bereinigte Daten (neues Objekt). */
  readonly data: Readonly<Rec>;
  /** Verworfene Datensätze je Schlüssel. */
  readonly quarantined: Readonly<Record<string, readonly unknown[]>>;
  /** Anzahl verworfener Datensätze. */
  readonly skipped: number;
  /** Anzahl reparierter Datensätze. */
  readonly repaired: number;
}

interface Accumulator {
  data: Rec;
  quarantined: Record<string, readonly unknown[]>;
  skipped: number;
  repaired: number;
}

function addList(acc: Accumulator, key: string, items: readonly unknown[], rejected: readonly unknown[], repaired: number): Accumulator {
  return {
    data: { ...acc.data, [key]: items },
    quarantined: rejected.length > 0 ? { ...acc.quarantined, [key]: rejected } : acc.quarantined,
    skipped: acc.skipped + rejected.length,
    repaired: acc.repaired + repaired,
  };
}

function sanitizeShopping(acc: Accumulator, value: unknown): Accumulator {
  if (value === null) return { ...acc, data: { ...acc.data, shopping: null } };
  const { list, rejected } = sanitizeShoppingList(value);
  if (list === null) {
    const { shopping: _drop, ...rest } = acc.data;
    return { ...acc, data: rest, quarantined: { ...acc.quarantined, shopping: [value] }, skipped: acc.skipped + 1 };
  }
  const next = addList(acc, 'shopping', [], rejected, 0);
  return { ...next, data: { ...next.data, shopping: list } };
}

/** Objekt-Wert (Profil, Wochenplan): `null` bleibt, Gültiges wird bereinigt, Unbrauchbares kommt in Quarantäne. */
function sanitizeObject(acc: Accumulator, key: string, value: unknown, clean: (v: unknown) => unknown): Accumulator {
  if (value === null) return { ...acc, data: { ...acc.data, [key]: null } };
  const cleaned = clean(value);
  if (cleaned !== null) return { ...acc, data: { ...acc.data, [key]: cleaned } };
  const { [key]: _drop, ...rest } = acc.data;
  return { ...acc, data: rest, quarantined: { ...acc.quarantined, [key]: [value] }, skipped: acc.skipped + 1 };
}

/** Gesperrte Rezept-Ids: nur Texte; Verworfenes kommt in Quarantäne. */
function sanitizeBlockedIds(acc: Accumulator, key: string, value: unknown): Accumulator {
  const items = sanitizeBlocked(value);
  const rejected = Array.isArray(value) ? value.filter((v) => typeof v !== 'string') : [value];
  return addList(acc, key, items, rejected, 0);
}

function sanitizeArrayKey(key: string, raw: unknown, check: (v: unknown) => boolean) {
  if (key === 'recipes') return sanitizeRecipes(raw);
  if (key === 'favorites') return sanitizeFavorites(raw);
  return sanitizeList(raw, check);
}

/** Bereinigt alle bekannten Listen eines Backups; unbekannte Schlüssel bleiben unverändert. */
export function sanitizeBackupData(data: Readonly<Rec>): BackupSanitizeResult {
  let acc: Accumulator = { data: { ...data }, quarantined: {}, skipped: 0, repaired: 0 };
  if ('diary' in data) {
    const r = sanitizeDiaryEntries(data['diary']);
    acc = addList(acc, 'diary', r.items, r.rejected, r.repaired);
  }
  for (const [key, check] of Object.entries(ARRAY_CHECKS)) {
    if (key === 'diary' || !(key in data)) continue;
    const r = sanitizeArrayKey(key, data[key], check);
    acc = addList(acc, key, r.items, r.rejected, r.repaired);
  }
  if ('weight' in data) {
    const r = sanitizeWeightEntries(data['weight']);
    acc = addList(acc, 'weight', r.items, r.rejected, r.repaired);
  }
  if ('shopping' in data) acc = sanitizeShopping(acc, data['shopping']);
  if ('profile' in data) acc = sanitizeObject(acc, 'profile', data['profile'], sanitizeProfile);
  if ('week-plan' in data) acc = sanitizeObject(acc, 'week-plan', data['week-plan'], sanitizeWeekPlan);
  if ('week-plan-blocked' in data) acc = sanitizeBlockedIds(acc, 'week-plan-blocked', data['week-plan-blocked']);
  return { data: acc.data, quarantined: acc.quarantined, skipped: acc.skipped, repaired: acc.repaired };
}
