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
import { ProxyAiProvider } from './proxy-ai-provider';
import { MockAiProvider } from './mock-ai-provider';
import { defaultAiProxyUrl } from './ai-endpoint';
import { AI_ERROR_MESSAGES } from './ai-errors';

export const NO_AI_MESSAGE = 'Kein KI-Dienst konfiguriert.';

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

  /** Prüft ohne KI-Kosten, ob der globale KI-Dienst erreichbar ist. */
  async testConnection(): Promise<AiTestResult> {
    if (!this.isLive()) return { ok: false, message: NO_AI_MESSAGE };
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
