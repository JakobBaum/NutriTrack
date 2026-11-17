/**
 * Bereinigung der gespeicherten Einkaufsliste (Laden und Import). Rein, wirft nie.
 * `null`/fehlend ist normal (keine Liste); ohne `items`-Array ist die Liste unbrauchbar (als Ganzes in `rejected`);
 * defekte Positionen kommen einzeln in `rejected`, Zusatzfelder der Liste bleiben erhalten.
 * Jede Position bekommt eine eindeutige `id` (Altbestand und Importe ohne oder mit doppelter id).
 */
import { isShoppingItem } from '../backup/backup-records';
import { isRec } from '../util/guards';
import { makeId } from '../util/id';
import { sanitizeList } from './record-sanitize';

export interface SanitizedShopping<T extends object = Record<string, unknown>> {
  /** Bereinigte Liste oder `null` (keine/unbrauchbar). */
  readonly list: T | null;
  /** Verworfene Positionen bzw. die ganze unbrauchbare Liste. */
  readonly rejected: readonly unknown[];
  /** True, wenn mindestens einer Position eine neue id vergeben wurde (Altbestand): zurückschreiben, damit sie stabil bleibt. */
  readonly hasNewIds?: boolean;
}

const ITEM_ID_PREFIX = 'item';
/** Erlaubte ids: kurz, ohne Sonderzeichen (sie landen in Attributen und Mengenvergleichen). */
const VALID_ID = /^[\w-]{1,80}$/;

/** Gibt jeder Position eine eindeutige, gültige id; vorhandene gültige ids bleiben unverändert. */
export function ensureItemIds<T extends { id?: unknown }>(items: readonly T[]): (T & { id: string })[] {
  const seen = new Set<string>();
  return items.map((it) => {
    const keep = typeof it.id === 'string' && VALID_ID.test(it.id) && !seen.has(it.id);
    const id = keep ? (it.id as string) : makeId(ITEM_ID_PREFIX);
    seen.add(id);
    return { ...it, id };
  });
}

export function sanitizeShoppingList<T extends object = Record<string, unknown>>(raw: unknown): SanitizedShopping<T> {
  if (raw === null || raw === undefined) return { list: null, rejected: [] };
  if (!isRec(raw) || !Array.isArray(raw['items'])) return { list: null, rejected: [raw] };
  const { items, rejected } = sanitizeList(raw['items'], isShoppingItem);
  const withIds = ensureItemIds(items as { id?: unknown }[]);
  const hasNewIds = withIds.some((it, i) => it.id !== (items[i] as { id?: unknown }).id);
  return { list: { ...raw, items: withIds } as unknown as T, rejected, hasNewIds };
}
