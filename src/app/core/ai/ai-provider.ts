import { InjectionToken } from '@angular/core';
import {
  DailyTarget,
  FastFoodRequest,
  FastFoodSuggestion,
  MealType,
  NutritionFacts,
  Recipe,
  ShoppingItem,
  UserProfile,
} from '../models';

/** Anfrage für die (Wochen-)Einkaufslisten-Generierung. */
export interface ShoppingPlanRequest {
  persons: number;
  days: number;
  /** Mahlzeiten je Tag (z.B. nur ['dinner'] oder ['lunch','dinner']). */
  meals: MealType[];
  /** Budget in EUR (optional). */
  budget?: number;
  /** Markt für Schätzpreise (optional, z.B. "Lidl"). */
  store?: string;
  /** Verfügbare, gespeicherte Rezepte als Basis. */
  recipes: Recipe[];
}

/** Ergebnis der Einkaufslisten-Generierung. */
export interface ShoppingPlanResult {
  items: ShoppingItem[];
  suggestedDishes: string[];
  /** Geschätzte Gesamtkosten in EUR. */
  estTotal: number;
  /** Erläuterung/Hinweis (z.B. „über Budget"). */
  note?: string;
}

/** Ergebnis der Etikett-Erkennung. */
export interface LabelResult {
  name: string;
  facts: NutritionFacts;
}

/**
 * Austauschbare KI-Schnittstelle. Konkrete Adapter: {@link MockAiProvider}
 * (deterministisch, kostenlos) und ClaudeAiProvider (Anthropic Messages API).
 * UI/Logik hängen ausschließlich an diesem Interface, nie am konkreten Anbieter.
 */
export interface AiProvider {
  /** Berechnet/empfiehlt das Tagesziel (KI darf Fallback-Formel überschreiben). */
  computeTargets(profile: UserProfile): Promise<DailyTarget>;

  /** Erzeugt eine Einkaufsliste (Personen × Tage × Mahlzeiten × Budget). */
  generateShoppingList(req: ShoppingPlanRequest): Promise<ShoppingPlanResult>;

  /** Liest Nährwerte von einem Etiketten-Foto (Base64, ohne data-URL-Präfix). */
  recognizeLabel(imageBase64: string, basis: 'per100g' | 'perPortion'): Promise<LabelResult>;

  /** Schlägt passende Fastfood-Optionen vor (proteinreich, im Budget). */
  suggestFastfood(req: FastFoodRequest): Promise<FastFoodSuggestion[]>;
}

/** DI-Token für den aktiven KI-Anbieter (Routing via {@link AiService}). */
export const AI_PROVIDER = new InjectionToken<AiProvider>('AI_PROVIDER');
