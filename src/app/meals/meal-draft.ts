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
