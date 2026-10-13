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
  ShoppingPlanRequest,
  ShoppingPlanResult,
} from './ai-provider';
import { ClaudeAiProvider } from './claude-ai-provider';
import { MockAiProvider } from './mock-ai-provider';

/**
 * Laufzeit-Router über {@link AiProvider}. Wählt pro Aufruf den aktiven Anbieter
 * anhand der Einstellungen: `claude` nur, wenn Provider gewählt UND ein Key
 * hinterlegt ist — sonst der kostenlose {@link MockAiProvider}. So funktionieren
 * alle KI-Flows auch ohne Key, und der Wechsel greift sofort ohne DI-Neuaufbau.
 */
@Injectable({ providedIn: 'root' })
export class AiService implements AiProvider {
  private readonly settings = inject(SettingsStore);
  private readonly mock = inject(MockAiProvider);
  private readonly claude = inject(ClaudeAiProvider);

  /** True, wenn aktuell gegen den echten Claude-Anbieter geroutet wird. */
  isLive(): boolean {
    const cfg = this.settings.ai();
    return cfg.provider === 'claude' && !!cfg.apiKey?.trim();
  }

  private active(): AiProvider {
    return this.isLive() ? this.claude : this.mock;
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
}
