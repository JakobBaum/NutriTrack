import { Recipe } from '../core/models';

/** Längste Quelle, die als Text angezeigt wird. */
const MAX_SOURCE_NAME_LENGTH = 80;
const WWW_PREFIX = /^www\./;

/** Anzeige der Quelle eines gespeicherten Rezepts. */
export interface RecipeSourceView {
  /** Anzeigename (Host oder Rohtext), `null` ohne gespeicherte Quelle. */
  readonly name: string | null;
  /** Nur http/https; sonst `null` (dann reiner Text ohne Link). */
  readonly url: string | null;
  /** Online-Rezept: Hinweis "Rezeptdaten von spoonacular.com". */
  readonly showSpoonacular: boolean;
}

function parseHttpUrl(value: string | null | undefined): URL | null {
  if (!value) return null;
  try {
    const parsed = new URL(value);
    return parsed.protocol === 'https:' || parsed.protocol === 'http:' ? parsed : null;
  } catch {
    return null;
  }
}

/** Gibt die Adresse zurück, wenn sie ein gültiger http/https-Link ist, sonst `null`. */
export function safeLinkUrl(value: string | null | undefined): string | null {
  return parseHttpUrl(value) ? (value as string) : null;
}

/** Quellenzeile für ein Rezept; `null`, wenn weder Quelle noch Online-Herkunft vorliegen. */
export function recipeSourceView(recipe: Pick<Recipe, 'origin' | 'sourceUrl'>): RecipeSourceView | null {
  const showSpoonacular = recipe.origin === 'online';
  const raw = recipe.sourceUrl?.trim() || null;
  if (!raw) return showSpoonacular ? { name: null, url: null, showSpoonacular } : null;
  const parsed = parseHttpUrl(raw);
  const name = (parsed ? parsed.hostname.replace(WWW_PREFIX, '') : raw).slice(0, MAX_SOURCE_NAME_LENGTH);
  return { name, url: parsed ? raw : null, showSpoonacular };
}
