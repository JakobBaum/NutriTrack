/**
 * Bereinigung des Gewichtsverlaufs (Laden und Import): gültige Einträge auf 0,1 kg gerundet, höchstens einer je Tag
 * (der jüngste gewinnt, frühere Doppelte werden still zusammengeführt), nach Datum sortiert. Rein, wirft nie.
 */
import { WeightEntry, roundKg } from '../weight/weight-math';
import { isWeightEntry } from '../backup/backup-records';
import { SanitizeResult, sanitizeList } from './record-sanitize';

export function sanitizeWeightEntries(raw: unknown): SanitizeResult<WeightEntry> {
  const base = sanitizeList<WeightEntry>(raw, isWeightEntry);
  const lastByDay = new Map<string, WeightEntry>();
  let repaired = 0;
  for (const e of base.items) {
    const rounded = roundKg(e.kg);
    if (rounded !== e.kg || lastByDay.has(e.dateISO)) repaired++;
    lastByDay.set(e.dateISO, { dateISO: e.dateISO, kg: rounded });
  }
  const items = Array.from(lastByDay.values()).sort((a, b) => a.dateISO.localeCompare(b.dateISO));
  return { items, rejected: base.rejected, repaired };
}
