import { HttpClient, HttpErrorResponse } from '@angular/common/http';
import { Injectable, inject } from '@angular/core';
import { firstValueFrom, timeout } from 'rxjs';
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
import { normalizeTranslatedTexts } from '../recipes/translate/translate-normalize';
import { DebugLogService } from '../debug/debug-log.service';
import { AI_ERROR_MESSAGES, AI_TIMEOUT_MS, friendlyAiErrorMessage, isTimeoutError, mapTimeoutError } from './ai-errors';
import { defaultAiProxyUrl } from './ai-endpoint';
import { ConsentService } from '../consent/consent.service';
import { ConsentRequiredError } from '../consent/consent.errors';
import { normalizeRecipeImport } from './recipe-import-normalize';
import { FASTFOOD_INVALID_MESSAGE, sanitizeFastfoodSuggestions } from './fastfood-sanitize';

const PING_FN = 'ping';
/** Läuft ohne Zutun des Nutzers im Hintergrund: öffnet nie den Zustimmungsdialog, sondern weicht auf lokale Wege aus. */
const BACKGROUND_FUNCTIONS: ReadonlySet<string> = new Set(['translateRecipe', 'translateSearchQuery']);
const UNKNOWN_FUNCTION_PATTERN = /^Unbekannte Funktion/;

/**
 * KI-Anbieter über den **internen Proxy** (Cloudflare-Worker `worker.js`).
 *
 * Alle Nutzer teilen sich EINEN serverseitigen Gemini-Key; die App sendet
 * nur `{ fn, payload }` an die globale Proxy-URL (environment.aiProxyUrl) und erhält das fertig
 * gemappte Ergebnis zurück. Kein Key im Client, fixe Prompts serverseitig.
 */
@Injectable({ providedIn: 'root' })
export class ProxyAiProvider implements AiProvider {
  private readonly http = inject(HttpClient);
  private readonly log = inject(DebugLogService);
  private readonly consent = inject(ConsentService);

  /** Ohne Zustimmung geht nichts an den Worker: Hintergrundaufrufe scheitern still, Nutzeraufrufe fragen nach. */
  private async requireConsent(fn: string): Promise<void> {
    if (this.consent.isGranted()) return;
    if (BACKGROUND_FUNCTIONS.has(fn) || !(await this.consent.ensure())) throw new ConsentRequiredError();
  }

  /** Bei vorhandener Zustimmung geht der Aufruf ohne Umweg hinaus; sonst erst nach der Prüfung. */
  private call<T>(fn: string, payload: unknown): Promise<T> {
    if (this.consent.isGranted()) return this.send<T>(fn, payload);
    return this.requireConsent(fn).then(() => this.send<T>(fn, payload));
  }

  private async send<T>(fn: string, payload: unknown): Promise<T> {
    const url = defaultAiProxyUrl();
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
        const msg = friendlyAiErrorMessage(err.status, isLinkImport(fn, payload));
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

  /** Die Antwort wird nie ungeprüft übernommen: nur plausible Einträge, sonst verständlicher Fehler. */
  async suggestFastfood(req: FastFoodRequest): Promise<FastFoodSuggestion[]> {
    const raw = await this.call<unknown>('suggestFastfood', req);
    if (Array.isArray(raw) && raw.length === 0) return [];
    const suggestions = sanitizeFastfoodSuggestions(raw);
    if (suggestions.length === 0) throw new Error(FASTFOOD_INVALID_MESSAGE);
    return suggestions;
  }

  async importRecipe(input: RecipeImportInput): Promise<RecipeImportResult> {
    const raw = await this.call<unknown>('importRecipe', input);
    return normalizeRecipeImport(raw, input.url);
  }

  async translateRecipe(texts: RecipeTexts, lang: TranslateLanguage): Promise<RecipeTexts> {
    const raw = await this.call<unknown>('translateRecipe', { ...texts, lang });
    return normalizeTranslatedTexts(raw, texts);
  }

  async translateSearchQuery(query: string, lang: TranslateLanguage): Promise<string> {
    const raw = await this.call<{ query?: unknown }>('translateSearchQuery', { query, lang });
    return typeof raw?.query === 'string' && raw.query.trim() ? raw.query.trim() : query;
  }

  /**
   * Erreichbarkeitstest ohne KI-Kosten. `ping` ist keine gültige Funktion: Der Worker
   * antwortet mit 400 „Unbekannte Funktion“, bevor Rate-Limit oder Gemini ausgelöst werden.
   * Diese Antwort zählt als erreichbar (auch bei einem älteren Worker ohne neue Routen).
   */
  async ping(): Promise<void> {
    const url = defaultAiProxyUrl();
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

/** Rezept-Import über eine Adresse (nicht über Text oder Foto). */
function isLinkImport(fn: string, payload: unknown): boolean {
  const url = (payload as { url?: unknown } | null)?.url;
  return fn === 'importRecipe' && typeof url === 'string' && url.length > 0;
}

function isUnknownFunctionResponse(err: unknown): boolean {
  if (!(err instanceof HttpErrorResponse) || err.status !== 400) return false;
  const detail: unknown = err.error?.error;
  return typeof detail === 'string' && UNKNOWN_FUNCTION_PATTERN.test(detail);
}
