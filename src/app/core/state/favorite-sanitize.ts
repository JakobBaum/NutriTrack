/**
 * Bereinigung gespeicherter Favoriten (Laden und Import): kaputte `baseFacts` entfallen (Favorit bleibt),
 * ein Favorit ohne gültige Pflichtangaben wird verworfen. Rein, wirft nie.
 */
import { isFavorite } from '../backup/backup-records';
import { isRec } from '../util/guards';
import { SanitizeResult, cleanFacts, sanitizeList } from './record-sanitize';

type Rec = Record<string, unknown>;

const hasBrokenBase = (rec: Rec): boolean => rec['baseFacts'] !== undefined && cleanFacts(rec['baseFacts']) === null;

function withoutBase(rec: Rec): Rec {
  const { baseFacts: _dropped, ...rest } = rec;
  return rest;
}

export function sanitizeFavorites<T = unknown>(raw: unknown): SanitizeResult<T> {
  if (!Array.isArray(raw)) return sanitizeList<T>(raw, isFavorite);
  const items: T[] = [];
  const rejected: unknown[] = [];
  let repaired = 0;
  for (const rec of raw) {
    const broken = isRec(rec) && hasBrokenBase(rec);
    const cleaned = broken ? withoutBase(rec) : rec;
    if (!isFavorite(cleaned)) {
      rejected.push(rec);
      continue;
    }
    items.push(cleaned as T);
    if (broken) repaired++;
  }
  return { items, rejected, repaired };
}
