import { Injectable, inject } from '@angular/core';
import {
  DailyTarget,
  FastFoodRequest,
  FastFoodSuggestion,
  UserProfile,
} from '../models';
import { SettingsStore } from '../state/settings.store';
import {
  AiProvider,
  LabelResult,
  RecipeImportInput,
  RecipeImportResult,
  ShoppingPlanRequest,
  ShoppingPlanResult,
} from './ai-provider';
import { GeminiAiProvider } from './gemini-ai-provider';
import { ProxyAiProvider } from './proxy-ai-provider';
import { MockAiProvider } from './mock-ai-provider';

/**
 * Laufzeit-Router über {@link AiProvider}. Wählt pro Aufruf den aktiven Anbieter
 * anhand der Einstellungen: `gemini` nur, wenn Provider gewählt UND ein Key
 * hinterlegt ist — sonst der kostenlose {@link MockAiProvider}. So funktionieren
 * alle KI-Flows auch ohne Key, und der Wechsel greift sofort ohne DI-Neuaufbau.
 */
@Injectable({ providedIn: 'root' })
export class AiService implements AiProvider {
  private readonly settings = inject(SettingsStore);
  private readonly mock = inject(MockAiProvider);
  private readonly gemini = inject(GeminiAiProvider);
  private readonly proxy = inject(ProxyAiProvider);

  /** True, wenn eine Proxy-URL hinterlegt ist (interner Key für alle Nutzer). */
  private hasProxy(): boolean {
    return !!this.settings.ai().proxyUrl?.trim();
  }

  /** True, wenn ein eigener Gemini-Key hinterlegt ist. */
  private hasOwnKey(): boolean {
    const cfg = this.settings.ai();
    return cfg.provider === 'gemini' && !!cfg.apiKey?.trim();
  }

  /** True, wenn echte KI aktiv ist (Proxy ODER eigener Key) statt Mock. */
  isLive(): boolean {
    return this.hasProxy() || this.hasOwnKey();
  }

  /** Bevorzugt den geteilten Proxy, dann eigener Key, sonst kostenloser Mock. */
  private active(): AiProvider {
    if (this.hasProxy()) return this.proxy;
    if (this.hasOwnKey()) return this.gemini;
    return this.mock;
  }

  computeTargets(profile: UserProfile): Promise<DailyTarget> {
    return this.active().computeTargets(profile);
  }

  generateShoppingList(req: ShoppingPlanRequest): Promise<ShoppingPlanResult> {
    return this.active().generateShoppingList(req);
  }

  recognizeLabel(imageBase64: string, basis: 'per100g' | 'perPortion'): Promise<LabelResult> {
    return this.active().recognizeLabel(imageBase64, basis);
  }

  suggestFastfood(req: FastFoodRequest): Promise<FastFoodSuggestion[]> {
    return this.active().suggestFastfood(req);
  }

  importRecipe(input: RecipeImportInput): Promise<RecipeImportResult> {
    return this.active().importRecipe(input);
  }
}
