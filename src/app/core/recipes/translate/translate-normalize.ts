import { RecipeTexts } from './translate.model';

function strings(value: unknown): string[] | null {
  return Array.isArray(value) && value.every((v) => typeof v === 'string') ? (value as string[]) : null;
}

/** Eintrag für Eintrag: leere oder fehlende Übersetzungen fallen auf das Original zurück. */
function pairwise(translated: string[] | null, source: readonly string[]): string[] {
  if (!translated || translated.length !== source.length) return [...source];
  return source.map((orig, i) => translated[i].trim() || orig);
}

/**
 * Prüft die Antwort der KI (nie vertrauen): Zutaten und Schritte müssen gleich viele Einträge wie das
 * Original haben, sonst bleibt das Original; Titel nur, wenn nicht leer.
 */
export function normalizeTranslatedTexts(raw: unknown, source: RecipeTexts): RecipeTexts {
  const r = (raw ?? {}) as Record<string, unknown>;
  const title = typeof r['title'] === 'string' && r['title'].trim() ? r['title'].trim() : source.title;
  return {
    title,
    ingredients: pairwise(strings(r['ingredients']), source.ingredients),
    steps: pairwise(strings(r['steps']), source.steps),
  };
}
