/**
 * Bereinigung der Datensätze eines Backups beim Import (Rolle 13 F4/F12): Ein einzelner defekter
 * Datensatz lehnt das Backup nicht mehr ab. Reparierbares wird repariert, der Rest kommt in Quarantäne.
 * Rein, ohne Browser-Abhängigkeit.
 */
import { sanitizeDiaryEntries, sanitizeList } from '../state/record-sanitize';
import { ARRAY_CHECKS, isShoppingItem, isWeightEntry } from './backup-records';

type Rec = Record<string, unknown>;

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

const isRec = (v: unknown): v is Rec => typeof v === 'object' && v !== null && !Array.isArray(v);

/** Gewichtsverlauf: gültige Einträge, höchstens einer je Tag (der letzte gewinnt). */
function sanitizeWeightList(raw: unknown): { items: unknown[]; rejected: unknown[] } {
  const base = sanitizeList<Rec>(raw, isWeightEntry);
  const lastByDay = new Map<unknown, Rec>();
  const duplicates: unknown[] = [];
  for (const e of base.items) {
    if (lastByDay.has(e['dateISO'])) duplicates.push(lastByDay.get(e['dateISO']));
    lastByDay.set(e['dateISO'], e);
  }
  return { items: Array.from(lastByDay.values()), rejected: [...base.rejected, ...duplicates] };
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
  if (!isRec(value) || !Array.isArray(value['items'])) {
    const { shopping: _drop, ...rest } = acc.data;
    return { ...acc, data: rest, quarantined: { ...acc.quarantined, shopping: [value] }, skipped: acc.skipped + 1 };
  }
  const { items, rejected } = sanitizeList(value['items'], isShoppingItem);
  const next = addList(acc, 'shopping', items, rejected, 0);
  return { ...next, data: { ...next.data, shopping: { ...value, items } } };
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
    const r = sanitizeList(data[key], check);
    acc = addList(acc, key, r.items, r.rejected, 0);
  }
  if ('weight' in data) {
    const r = sanitizeWeightList(data['weight']);
    acc = addList(acc, 'weight', r.items, r.rejected, 0);
  }
  if ('shopping' in data) acc = sanitizeShopping(acc, data['shopping']);
  return { data: acc.data, quarantined: acc.quarantined, skipped: acc.skipped, repaired: acc.repaired };
}
