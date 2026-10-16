import { HttpClient } from '@angular/common/http';
import { Injectable, inject } from '@angular/core';
import { firstValueFrom } from 'rxjs';
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

/**
 * KI-Anbieter über den **internen Proxy** ({@link server/anthropic-proxy}).
 *
 * Alle Nutzer teilen sich EINEN serverseitigen Anthropic-Key; die App sendet
 * nur `{ fn, payload }` an die konfigurierte Proxy-URL und erhält das fertig
 * gemappte Ergebnis zurück. Kein Key im Client, fixe Prompts serverseitig.
 */
@Injectable({ providedIn: 'root' })
export class ProxyAiProvider implements AiProvider {
  private readonly http = inject(HttpClient);
  private readonly settings = inject(SettingsStore);

  private async call<T>(fn: string, payload: unknown): Promise<T> {
    const url = this.settings.ai().proxyUrl?.trim();
    if (!url) throw new Error('Keine KI-Proxy-URL konfiguriert.');
    return firstValueFrom(
      this.http.post<T>(url, { fn, payload }, { headers: { 'content-type': 'application/json' } }),
    );
  }

  computeTargets(profile: UserProfile): Promise<DailyTarget> {
    return this.call<DailyTarget>('computeTargets', profile);
  }

  generateShoppingList(req: ShoppingPlanRequest): Promise<ShoppingPlanResult> {
    return this.call<ShoppingPlanResult>('generateShoppingList', req);
  }

  recognizeLabel(imageBase64: string, basis: 'per100g' | 'perPortion'): Promise<LabelResult> {
    return this.call<LabelResult>('recognizeLabel', { imageBase64, basis });
  }

  suggestFastfood(req: FastFoodRequest): Promise<FastFoodSuggestion[]> {
    return this.call<FastFoodSuggestion[]>('suggestFastfood', req);
  }

  importRecipe(input: RecipeImportInput): Promise<RecipeImportResult> {
    return this.call<RecipeImportResult>('importRecipe', input);
  }
}
