import { Injectable, inject } from '@angular/core';
import { AiService } from '../../ai/ai.service';
import { RecipeImportResult } from '../../ai/ai-provider';
import { OnlineRecipe } from './online-recipe.model';

/** Rezept als Klartext für den KI-Import (der Gemini-Prompt schreibt Zutaten und Schritte auf Deutsch). */
export function recipeToImportText(recipe: OnlineRecipe): string {
  const ingredientLines = recipe.ingredients.map((i) => `${i.amount} ${i.unit} ${i.name}`.replace(/\s+/g, ' ').trim());
  return [recipe.title, ...ingredientLines, ...recipe.steps].join('\n');
}

/**
 * Übernimmt NUR Texte (Titel, Zutatennamen, Schritte) aus der Übersetzung; Mengen, Einheiten und
 * Nährwerte bleiben vom Original. Zutatennamen nur bei gleicher Anzahl (sonst Original).
 */
export function applyTranslation(recipe: OnlineRecipe, translated: RecipeImportResult): OnlineRecipe {
  const sameIngredients = translated.ingredients.length === recipe.ingredients.length;
  return {
    ...recipe,
    title: translated.title.trim() || recipe.title,
    ingredients: sameIngredients
      ? recipe.ingredients.map((ing, i) => ({ ...ing, name: translated.ingredients[i].name.trim() || ing.name }))
      : recipe.ingredients,
    steps: translated.steps.length > 0 ? translated.steps : recipe.steps,
  };
}

/** Übersetzt Online-Rezepte über den vorhandenen {@link AiService}; bei Fehlern bleibt das Original. */
@Injectable({ providedIn: 'root' })
export class RecipeTranslateService {
  private readonly ai = inject(AiService);

  canTranslate(): boolean {
    return this.ai.isLive();
  }

  async toGerman(recipe: OnlineRecipe): Promise<OnlineRecipe> {
    if (!this.canTranslate()) return recipe;
    try {
      const res = await this.ai.importRecipe({ text: recipeToImportText(recipe) });
      return applyTranslation(recipe, res);
    } catch {
      return recipe;
    }
  }
}
