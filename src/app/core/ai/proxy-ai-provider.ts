import { HttpClient, HttpErrorResponse } from '@angular/common/http';
import { Injectable, inject } from '@angular/core';
import { firstValueFrom, timeout } from 'rxjs';
import {
  FastFoodRequest,
  FastFoodSuggestion,
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
import { DebugLogService } from '../debug/debug-log.service';
import { AI_ERROR_MESSAGES, AI_TIMEOUT_MS, friendlyAiErrorMessage, isTimeoutError, mapTimeoutError } from './ai-errors';
import { effectiveProxyUrl } from './ai-endpoint';
import { normalizeRecipeImport } from './recipe-import-normalize';

const PING_FN = 'ping';
const UNKNOWN_FUNCTION_PATTERN = /^Unbekannte Funktion/;

/**
 * KI-Anbieter über den **internen Proxy** (Cloudflare-Worker `worker.js`).
 *
 * Alle Nutzer teilen sich EINEN serverseitigen Gemini-Key; die App sendet
 * nur `{ fn, payload }` an die effektive Proxy-URL (eigene Adresse oder Standard) und erhält das fertig
 * gemappte Ergebnis zurück. Kein Key im Client, fixe Prompts serverseitig.
 */
@Injectable({ providedIn: 'root' })
export class ProxyAiProvider implements AiProvider {
  private readonly http = inject(HttpClient);
  private readonly settings = inject(SettingsStore);
  private readonly log = inject(DebugLogService);

  private async call<T>(fn: string, payload: unknown): Promise<T> {
    const url = effectiveProxyUrl(this.settings.ai());
    if (!url) throw new Error('Keine KI-Proxy-URL konfiguriert.');
    this.log.info(`→ ${fn}`);
    try {
      const result = await firstValueFrom(
        this.http.post<T>(url, { fn, payload }, { headers: { 'content-type': 'application/json' } })
          .pipe(timeout(AI_TIMEOUT_MS)),
      );
      this.log.success(`✓ ${fn} OK`);
      return result;
    } catch (err) {
      if (err instanceof HttpErrorResponse) {
        const msg = friendlyAiErrorMessage(err.status);
        this.log.error(`✗ ${fn}: HTTP ${err.status} ${err.error?.error ?? err.statusText ?? ''}`.trim());
        throw new Error(msg);
      }
      this.log.error(`✗ ${fn}: ${(err as Error).message}`);
      throw mapTimeoutError(err);
    }
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

  async importRecipe(input: RecipeImportInput): Promise<RecipeImportResult> {
    const raw = await this.call<unknown>('importRecipe', input);
    return normalizeRecipeImport(raw, input.url);
  }

  /**
   * Erreichbarkeitstest ohne KI-Kosten. `ping` ist keine gültige Funktion: Der Worker
   * antwortet mit 400 „Unbekannte Funktion“, bevor Rate-Limit oder Gemini ausgelöst werden.
   * Diese Antwort zählt als erreichbar (auch bei einem älteren Worker ohne neue Routen).
   */
  async ping(): Promise<void> {
    const url = effectiveProxyUrl(this.settings.ai());
    if (!url) throw new Error('Keine KI-Proxy-URL konfiguriert.');
    try {
      await firstValueFrom(
        this.http.post(url, { fn: PING_FN, payload: {} }, { headers: { 'content-type': 'application/json' } })
          .pipe(timeout(AI_TIMEOUT_MS)),
      );
    } catch (err: unknown) {
      if (isUnknownFunctionResponse(err)) return;
      if (isTimeoutError(err)) throw new Error(AI_ERROR_MESSAGES.timeout);
      const status = err instanceof HttpErrorResponse ? err.status : 0;
      throw new Error(friendlyAiErrorMessage(status));
    }
  }
}

function isUnknownFunctionResponse(err: unknown): boolean {
  if (!(err instanceof HttpErrorResponse) || err.status !== 400) return false;
  const detail: unknown = err.error?.error;
  return typeof detail === 'string' && UNKNOWN_FUNCTION_PATTERN.test(detail);
}
