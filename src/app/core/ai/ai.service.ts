import { Injectable, inject } from '@angular/core';
import {
  DailyTarget,
  FastFoodRequest,
  FastFoodSuggestion,
  UserProfile,
} from '../models';
import { SettingsStore } from '../state/settings.store';
import { DebugLogService } from '../debug/debug-log.service';
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
import {
  AI_ROUTE_LABELS,
  AiRoute,
  NO_AI_ROUTE_MESSAGE,
  resolveAiRoutes,
  runWithFallback,
} from './ai-route';
import { AI_ERROR_MESSAGES } from './ai-errors';

/** Ergebnis des Verbindungstests für den aktiven (ersten) Weg. */
export interface AiTestResult {
  route: AiRoute | 'none';
  ok: boolean;
  message: string;
}

/**
 * Laufzeit-Router über {@link AiProvider}. Die Wege und ihre Reihenfolge
 * kommen aus {@link resolveAiRoutes}: eigener Key (Gemini direkt) zuerst, sonst
 * der KI-Server (Worker). Scheitert der erste Weg, wird der nächste versucht.
 * Ohne jeden Weg greift der kostenlose {@link MockAiProvider}.
 */
@Injectable({ providedIn: 'root' })
export class AiService implements AiProvider {
  private readonly settings = inject(SettingsStore);
  private readonly mock = inject(MockAiProvider);
  private readonly gemini = inject(GeminiAiProvider);
  private readonly proxy = inject(ProxyAiProvider);
  private readonly log = inject(DebugLogService);

  /** True, wenn echte KI aktiv ist (eigener Key ODER KI-Server) statt Mock. */
  isLive(): boolean {
    return this.routes().length > 0;
  }

  computeTargets(profile: UserProfile): Promise<DailyTarget> {
    return this.run((p) => p.computeTargets(profile));
  }

  generateShoppingList(req: ShoppingPlanRequest): Promise<ShoppingPlanResult> {
    return this.run((p) => p.generateShoppingList(req));
  }

  recognizeLabel(imageBase64: string, basis: 'per100g' | 'perPortion'): Promise<LabelResult> {
    return this.run((p) => p.recognizeLabel(imageBase64, basis));
  }

  suggestFastfood(req: FastFoodRequest): Promise<FastFoodSuggestion[]> {
    return this.run((p) => p.suggestFastfood(req));
  }

  importRecipe(input: RecipeImportInput): Promise<RecipeImportResult> {
    return this.run((p) => p.importRecipe(input));
  }

  /**
   * Prüft den aktiven Weg (den ersten gültigen) ohne KI-Kosten. Der Test nutzt die
   * gespeicherten Einstellungen, nicht ungespeicherte Eingaben im Formular.
   */
  async testConnection(): Promise<AiTestResult> {
    const [route] = this.routes();
    if (!route) return { route: 'none', ok: false, message: NO_AI_ROUTE_MESSAGE };
    try {
      await this.pingRoute(route);
      return { route, ok: true, message: `${AI_ROUTE_LABELS[route]} ist erreichbar.` };
    } catch (err) {
      const reason = err instanceof Error ? err.message : AI_ERROR_MESSAGES.generic;
      return { route, ok: false, message: `${AI_ROUTE_LABELS[route]}: ${reason}` };
    }
  }

  private routes(): AiRoute[] {
    return resolveAiRoutes(this.settings.ai());
  }

  private providerFor(route: AiRoute): AiProvider {
    return route === 'ownKey' ? this.gemini : this.proxy;
  }

  private pingRoute(route: AiRoute): Promise<void> {
    return route === 'ownKey' ? this.gemini.ping() : this.proxy.ping();
  }

  /** Führt einen Aufruf über die Wegkette aus; ohne Wege über den Mock. */
  private run<T>(call: (provider: AiProvider) => Promise<T>): Promise<T> {
    const routes = this.routes();
    if (routes.length === 0) return call(this.mock);
    return runWithFallback(
      routes,
      (route) => call(this.providerFor(route)),
      (failed, err) => this.log.info(`${AI_ROUTE_LABELS[failed]} fehlgeschlagen, weiche aus: ${describeError(err)}`),
    );
  }
}

function describeError(err: unknown): string {
  return err instanceof Error ? err.message : AI_ERROR_MESSAGES.generic;
}
