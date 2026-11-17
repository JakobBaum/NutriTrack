import { RecipeTexts } from './translate.model';

function strings(value: unknown): string[] | null {
  return Array.isArray(value) && value.every((v) => typeof v === 'string') ? (value as string[]) : null;
}

/** Eintrag für Eintrag: leere Übersetzungen fallen auf das Original zurück; falsche Zeilenzahl ist ein Fehler. */
function pairwise(raw: unknown, source: readonly string[], label: string): string[] {
  // Bei leerer Quelle ist ein fehlendes Feld in Ordnung (z. B. Rezept ohne Schritte).
  if (source.length === 0 && (raw === undefined || raw === null)) return [];
  const translated = strings(raw);
  if (!translated || translated.length !== source.length) {
    throw new Error(`Übersetzung unbrauchbar: ${label} nicht in passender Anzahl`);
  }
  return source.map((orig, i) => translated[i].trim() || orig);
}

/**
 * Prüft die Antwort der KI (nie vertrauen): Zutaten und Schritte müssen gleich viele Einträge wie das
 * Original haben, sonst wird die Antwort verworfen (Fehler, damit das Original nicht als übersetzt gilt);
 * der Titel zählt nur, wenn nicht leer.
 */
export function normalizeTranslatedTexts(raw: unknown, source: RecipeTexts): RecipeTexts {
  const r = (raw ?? {}) as Record<string, unknown>;
  const title = typeof r['title'] === 'string' && r['title'].trim() ? r['title'].trim() : source.title;
  return {
    title,
    ingredients: pairwise(r['ingredients'], source.ingredients, 'Zutaten'),
    steps: pairwise(r['steps'], source.steps, 'Schritte'),
  };
}
