import { Recipe } from '../models';
import { ResolveOutcome } from '../recipes/online/online-recipe-details.service';

/** Rezepte für die Planung: aufgelöste Rezepte und die Titel der Verweise, die nicht geladen werden konnten. */
export interface PlanRecipes {
  readonly recipes: readonly Recipe[];
  readonly skipped: readonly string[];
}

/** Trennt Erfolge und Fehler; jeder Fehler wird protokolliert (nicht verschluckt), der Titel wandert in `skipped`. */
export function splitOutcomes(outcomes: readonly ResolveOutcome[]): PlanRecipes {
  const recipes: Recipe[] = [];
  const skipped: string[] = [];
  for (const outcome of outcomes) {
    if (outcome.ok) {
      recipes.push(outcome.recipe);
      continue;
    }
    console.error('NutriTrack: Rezept für die Einkaufsliste nicht geladen', outcome.source.title, outcome.error);
    skipped.push(outcome.source.title);
  }
  return { recipes, skipped };
}

/** Hinweis beim Titel der Liste ("Nicht geladen: A, B"); leer, wenn nichts ausgelassen wurde. */
export function skippedNote(skipped: readonly string[]): string | undefined {
  return skipped.length > 0 ? `Nicht geladen: ${skipped.join(', ')}` : undefined;
}

/** Fügt den Hinweis des Anbieters und den Hinweis zu ausgelassenen Rezepten zusammen. */
export function joinNotes(...notes: readonly (string | undefined)[]): string | undefined {
  const present = notes.filter((n): n is string => !!n);
  return present.length > 0 ? present.join(' ') : undefined;
}
