/** Warum „Mahlzeit speichern“ gerade nicht geht (leer = es geht). */
export function mealSaveBlockReason(name: string, entryCount: number): string {
  if (!name.trim()) return 'Gib der Mahlzeit einen Namen.';
  if (entryCount === 0) return 'Füge mindestens ein Lebensmittel oder Rezept hinzu.';
  return '';
}

/** True, wenn im Entwurf schon etwas eingegeben wurde (→ beim Schließen „Verwerfen?“). */
export function isMealDraftDirty(name: string, entryCount: number): boolean {
  return name.trim().length > 0 || entryCount > 0;
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
