import { parseDecimal } from '../core/util/number-input';

/** Warum „Mahlzeit speichern“ gerade nicht geht (leer = es geht). */
export function mealSaveBlockReason(name: string, entryCount: number): string {
  if (!name.trim()) return 'Gib der Mahlzeit einen Namen.';
  if (entryCount === 0) return 'Füge mindestens ein Lebensmittel oder Rezept hinzu.';
  return '';
}

interface DraftLike {
  label: string;
  amountG?: number;
  facts: { kcal: number };
}

/** True, wenn Name oder Einträge vom Ausgangszustand (Neu: leer, Bearbeiten: gespeichert) abweichen. */
export function isMealDraftChanged(
  baseline: { name: string; entries: readonly DraftLike[] },
  name: string,
  entries: readonly DraftLike[],
): boolean {
  if (baseline.name.trim() !== name.trim()) return true;
  return JSON.stringify(baseline.entries) !== JSON.stringify(entries);
}

/** Rechnet einen Eintrag auf eine neue Menge (g) um; Nährwerte skalieren linear zur alten Menge. */
export function rescaleEntryAmount<T extends { amountG?: number; facts: object }>(entry: T, amountG: number): T {
  const old = entry.amountG;
  if (!old || old <= 0 || !(amountG > 0)) return entry;
  const factor = amountG / old;
  const scaled: Record<string, unknown> = {};
  for (const [key, value] of Object.entries(entry.facts)) {
    scaled[key] = typeof value === 'number' ? Math.round(value * factor * 10) / 10 : value;
  }
  return { ...entry, amountG, facts: scaled as T['facts'] };
}

/**
 * Skaliert den Eintrag `index` immer vom Ursprungseintrag (Ursprungsmenge und -werte), nicht vom
 * zuletzt gerundeten Wert. Ungültige Menge (leer, 0, NaN) lässt alles unverändert. Liefert eine neue Liste.
 */
export function rescaleDraftEntry<T extends { amountG?: number; facts: object }>(
  entries: readonly T[],
  origins: readonly T[],
  index: number,
  amountG: number,
): T[] {
  const origin = origins[index];
  if (!origin || !(amountG > 0)) return [...entries];
  return entries.map((entry, i) => (i === index ? rescaleEntryAmount(origin, amountG) : entry));
}

/** "1 Eintrag" / "3 Einträge". */
export function entryCountLabel(count: number): string {
  return `${count} ${count === 1 ? 'Eintrag' : 'Einträge'}`;
}

/** Warum "Hinzufügen" bei der manuellen Eingabe gerade nicht geht (leer = es geht). */
export function manualBlockReason(name: string, kcalText: string): string {
  if (!name.trim()) return 'Gib dem Lebensmittel einen Namen.';
  const kcal = parseDecimal(kcalText);
  if (kcal === null || !(kcal > 0)) return 'Trage die Kalorien ein (größer als 0).';
  return '';
}
