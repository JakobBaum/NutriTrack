import { Injectable, inject } from '@angular/core';
import {
  FastFoodRequest,
  FastFoodSuggestion,
} from '../models';
import {
  AiProvider,
  LabelResult,
  RecipeImportInput,
  RecipeImportResult,
  ShoppingPlanRequest,
  ShoppingPlanResult,
} from './ai-provider';
import { RecipeTexts, TranslateLanguage } from '../recipes/translate/translate.model';
import { ProxyAiProvider } from './proxy-ai-provider';
import { MockAiProvider } from './mock-ai-provider';
import { defaultAiProxyUrl } from './ai-endpoint';
import { ConsentService } from '../consent/consent.service';
import { AI_ERROR_MESSAGES } from './ai-errors';
import { MealParseResult } from './meal-parse';

export const NO_AI_MESSAGE = 'Kein KI-Dienst konfiguriert.';
export const NO_CONSENT_TEST_MESSAGE = 'Ohne Zustimmung wird keine Verbindung zum KI-Dienst aufgebaut.';

/** Ergebnis des Erreichbarkeitstests des globalen KI-Dienstes. */
export interface AiTestResult {
  ok: boolean;
  message: string;
}

/**
 * Laufzeit-Router über {@link AiProvider}: Alle KI-Aufrufe laufen ausschließlich über den
 * globalen KI-Server (Worker, `environment.aiProxyUrl`). Ohne konfigurierte Adresse greift
 * der kostenlose {@link MockAiProvider}. Es gibt keine Nutzer-Einstellung für die Verbindung.
 */
@Injectable({ providedIn: 'root' })
export class AiService implements AiProvider {
  private readonly mock = inject(MockAiProvider);
  private readonly proxy = inject(ProxyAiProvider);
  private readonly consent = inject(ConsentService);

  /** True, wenn der globale KI-Server konfiguriert ist (sonst Mock). */
  isLive(): boolean {
    return defaultAiProxyUrl() !== '';
  }

  generateShoppingList(req: ShoppingPlanRequest): Promise<ShoppingPlanResult> {
    return this.provider().generateShoppingList(req);
  }

  recognizeLabel(imageBase64: string, basis: 'per100g' | 'perPortion'): Promise<LabelResult> {
    return this.provider().recognizeLabel(imageBase64, basis);
  }

  suggestFastfood(req: FastFoodRequest): Promise<FastFoodSuggestion[]> {
    return this.provider().suggestFastfood(req);
  }

  importRecipe(input: RecipeImportInput): Promise<RecipeImportResult> {
    return this.provider().importRecipe(input);
  }

  parseMeal(text: string): Promise<MealParseResult> {
    return this.provider().parseMeal(text);
  }

  translateRecipe(texts: RecipeTexts, lang: TranslateLanguage): Promise<RecipeTexts> {
    return this.provider().translateRecipe(texts, lang);
  }

  translateSearchQuery(query: string, lang: TranslateLanguage): Promise<string> {
    return this.provider().translateSearchQuery(query, lang);
  }

  /** Prüft ohne KI-Kosten, ob der globale KI-Dienst erreichbar ist. */
  async testConnection(): Promise<AiTestResult> {
    if (!this.isLive()) return { ok: false, message: NO_AI_MESSAGE };
    // Auch der Test sendet eine Anfrage an den Server; nach Widerruf darf nichts mehr hinausgehen (K9).
    if (!this.consent.isGranted()) return { ok: false, message: NO_CONSENT_TEST_MESSAGE };
    try {
      await this.proxy.ping();
      return { ok: true, message: 'KI-Dienst ist erreichbar.' };
    } catch (err) {
      const reason = err instanceof Error ? err.message : AI_ERROR_MESSAGES.generic;
      return { ok: false, message: `KI-Dienst nicht erreichbar: ${reason}` };
    }
  }

  private provider(): AiProvider {
    return this.isLive() ? this.proxy : this.mock;
  }
}
