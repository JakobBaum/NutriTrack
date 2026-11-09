import { Injectable, computed, inject, signal } from '@angular/core';
import { AiService } from '../../ai/ai.service';
import { AppSettingsStore } from '../../state/app-settings.store';
import { OnlineRecipe } from '../online/online-recipe.model';
import { translateIngredientName } from './ingredient-dictionary';
import { RecipeTexts, TranslationResult } from './translate.model';
import { TranslationCache, cacheKey } from './translation-cache';

/** Titel, Zutatennamen und Schritte eines Rezepts. */
export function recipeTexts(recipe: Pick<OnlineRecipe, 'title' | 'ingredients' | 'steps'>): RecipeTexts {
  return { title: recipe.title, ingredients: recipe.ingredients.map((i) => i.name), steps: [...recipe.steps] };
}

/**
 * Übernimmt NUR Texte (Titel, Zutatennamen, Schritte); Mengen, Einheiten und Nährwerte bleiben vom Original.
 * Zutatennamen und Schritte nur bei gleicher Anzahl (sonst Original). `lang` markiert den Übersetzungsstand.
 */
export function applyTranslation<T extends OnlineRecipe>(recipe: T, texts: RecipeTexts, complete: boolean): T {
  const sameIngredients = texts.ingredients.length === recipe.ingredients.length;
  const sameSteps = texts.steps.length === recipe.steps.length;
  return {
    ...recipe,
    title: texts.title.trim() || recipe.title,
    ingredients: sameIngredients
      ? recipe.ingredients.map((ing, i) => ({ ...ing, name: texts.ingredients[i].trim() || ing.name }))
      : recipe.ingredients,
    steps: sameSteps ? texts.steps : recipe.steps,
    lang: complete ? 'de' : 'en',
  };
}

/** Rezept ist in der App-Sprache (nichts mehr zu tun). */
export function isTranslated(recipe: Pick<OnlineRecipe, 'lang'>): boolean {
  return recipe.lang === 'de';
}

/**
 * Übersetzt Online-Rezepte in die App-Sprache: lokaler Cache, sonst KI (Worker `translateRecipe`),
 * sonst ehrlicher Rückfall (Zutaten per Wörterbuch, Titel/Schritte bleiben Englisch, `lang: 'en'`).
 * Nur vollständige KI-Ergebnisse werden zwischengespeichert; gleiche Rezepte laufen nie doppelt.
 */
@Injectable({ providedIn: 'root' })
export class RecipeTranslateService {
  private readonly ai = inject(AiService);
  private readonly cache = inject(TranslationCache);
  private readonly settings = inject(AppSettingsStore);
  private readonly inFlight = new Map<string, Promise<TranslationResult>>();
  private readonly pending = signal(0);

  /** Anzahl laufender Übersetzungen (für "übersetze..."-Anzeigen). */
  readonly pendingCount = this.pending.asReadonly();
  readonly isTranslating = computed(() => this.pending() > 0);

  /** Ob eine KI-Übersetzung möglich ist (sonst nur Wörterbuch). */
  canTranslate(): boolean {
    return this.ai.isLive();
  }

  /** Liefert das Rezept in der App-Sprache; schlägt nie fehl (Rückfall = Original mit `lang: 'en'`). */
  async translate<T extends OnlineRecipe>(recipe: T): Promise<T> {
    if (isTranslated(recipe)) return recipe;
    const source = recipeTexts(recipe);
    const { texts, complete } = await this.resolve(recipe.id, source);
    return applyTranslation(recipe, texts, complete);
  }

  /** Übersetzt alle Rezepte nacheinander (schont das Tageslimit); `onProgress(erledigt, gesamt)`. */
  async translateAll<T extends OnlineRecipe>(recipes: readonly T[], onProgress?: (done: number, total: number) => void): Promise<T[]> {
    const out: T[] = [];
    onProgress?.(0, recipes.length);
    for (const r of recipes) {
      out.push(await this.translate(r));
      onProgress?.(out.length, recipes.length);
    }
    return out;
  }

  /** Ob ein Rezept (noch) übersetzt werden soll; schon erfolglos versuchte nur, wenn die KI erreichbar sein kann. */
  needsTranslation(recipe: Pick<OnlineRecipe, 'lang'>): boolean {
    return recipe.lang === undefined || (recipe.lang === 'en' && this.canTranslate());
  }

  /** Suchbegriff fürs Englische: KI, sonst Wörterbuch; `translated` zeigt, ob sich etwas geändert hat. */
  async translateQuery(query: string): Promise<{ query: string; viaAi: boolean }> {
    const trimmed = query.trim();
    if (!trimmed) return { query: trimmed, viaAi: false };
    const viaAi = this.ai.isLive();
    try {
      return { query: await this.ai.translateSearchQuery(trimmed, this.settings.appLanguage), viaAi };
    } catch {
      return { query: trimmed, viaAi: false };
    }
  }

  private resolve(id: string, source: RecipeTexts): Promise<TranslationResult> {
    const lang = this.settings.appLanguage;
    const key = cacheKey(lang, id, source);
    const cached = this.cache.get(key);
    if (cached) return Promise.resolve({ texts: cached, complete: true });
    const running = this.inFlight.get(key);
    if (running) return running;
    const job = this.run(key, source).finally(() => this.inFlight.delete(key));
    this.inFlight.set(key, job);
    return job;
  }

  private async run(key: string, source: RecipeTexts): Promise<TranslationResult> {
    this.pending.update((n) => n + 1);
    try {
      const complete = this.ai.isLive();
      const texts = await this.ai.translateRecipe(source, this.settings.appLanguage);
      if (complete) this.cache.set(key, texts);
      return { texts, complete };
    } catch {
      return { texts: { ...source, ingredients: source.ingredients.map(translateIngredientName) }, complete: false };
    } finally {
      this.pending.update((n) => n - 1);
    }
  }
}
