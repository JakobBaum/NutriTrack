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
  ShoppingPlanRequest,
  ShoppingPlanResult,
} from './ai-provider';

const DEFAULT_ENDPOINT = 'https://api.anthropic.com/v1/messages';
// Modell-Routing: klein & günstig als Standard, größer nur für Vision.
const MODEL_LIGHT = 'claude-haiku-4-5-20251001';
const MODEL_VISION = 'claude-sonnet-4-6';

interface AnthropicTextBlock {
  type: string;
  text?: string;
}
interface AnthropicResponse {
  content?: AnthropicTextBlock[];
}

/**
 * KI-Anbieter über die **Anthropic Messages API** (Claude).
 * Key/Endpoint/Modell kommen aus den lokal gespeicherten Einstellungen
 * ({@link SettingsStore}). Modell-Routing: {@link MODEL_LIGHT} für einfache,
 * strukturierte Tasks (günstig), {@link MODEL_VISION} nur für Etikett-Vision.
 * Alle Antworten werden als JSON erzwungen und defensiv geparst (Schema-Guard).
 */
@Injectable({ providedIn: 'root' })
export class ClaudeAiProvider implements AiProvider {
  private readonly http = inject(HttpClient);
  private readonly settings = inject(SettingsStore);

  async computeTargets(profile: UserProfile): Promise<DailyTarget> {
    const sys =
      'Du bist Ernährungsrechner. Antworte NUR mit JSON: ' +
      '{"kcal":number,"proteinG":number,"carbsG":number,"fatG":number,"fiberG":number,"sugarG":number}. ' +
      'Nutze Mifflin-St Jeor + Aktivitätsfaktor + Ziel-Anpassung. Keine Erklärung.';
    const user = `Profil: ${JSON.stringify(profile)}`;
    const obj = await this.callJson(sys, user, this.model(MODEL_LIGHT), 400);
    return {
      kcal: this.num(obj['kcal']),
      proteinG: this.num(obj['proteinG']),
      carbsG: this.num(obj['carbsG']),
      fatG: this.num(obj['fatG']),
      fiberG: this.num(obj['fiberG']),
      sugarG: this.num(obj['sugarG']),
    };
  }

  async generateShoppingList(req: ShoppingPlanRequest): Promise<ShoppingPlanResult> {
    const recipeTitles = req.recipes.map((r) => ({
      title: r.title,
      servings: r.servings,
      ingredients: r.ingredients,
    }));
    const sys =
      'Du erstellst Einkaufslisten. Antworte NUR mit JSON: ' +
      '{"items":[{"name":string,"amount":number,"unit":string,"estPrice":number}],' +
      '"suggestedDishes":[string],"estTotal":number,"note":string}. ' +
      'Fasse gleiche Zutaten zusammen. estPrice/estTotal in EUR (Schätzung für den Markt). ' +
      'Bleibe möglichst im Budget. Nutze vorhandene Rezepte, ergänze sonst sinnvoll.';
    const user = JSON.stringify({
      persons: req.persons,
      days: req.days,
      meals: req.meals,
      budget: req.budget,
      store: req.store,
      recipes: recipeTitles,
    });
    const obj = await this.callJson(sys, user, this.model(MODEL_LIGHT), 1500);
    const items = Array.isArray(obj['items'])
      ? (obj['items'] as Record<string, unknown>[]).map((i) => ({
          name: String(i['name'] ?? ''),
          amount: this.num(i['amount']),
          unit: String(i['unit'] ?? 'g'),
          checked: false,
          estPrice: this.num(i['estPrice']),
        }))
      : [];
    return {
      items,
      suggestedDishes: Array.isArray(obj['suggestedDishes'])
        ? (obj['suggestedDishes'] as unknown[]).map(String)
        : [],
      estTotal: this.num(obj['estTotal']),
      note: obj['note'] ? String(obj['note']) : undefined,
    };
  }

  async recognizeLabel(
    imageBase64: string,
    basis: 'per100g' | 'perPortion',
  ): Promise<LabelResult> {
    const sys =
      'Du liest Nährwert-Etiketten. Antworte NUR mit JSON: ' +
      '{"name":string,"kcal":number,"proteinG":number,"carbsG":number,"fatG":number,' +
      '"fiberG":number,"sugarG":number}. ' +
      `Werte beziehen sich auf ${basis === 'per100g' ? '100 g' : 'eine Portion'}.`;
    const content = [
      { type: 'image', source: { type: 'base64', media_type: 'image/jpeg', data: imageBase64 } },
      { type: 'text', text: 'Lies die Nährwerte vom Etikett.' },
    ];
    const obj = await this.callJsonRaw(sys, content, this.model(MODEL_VISION), 500);
    return {
      name: String(obj['name'] ?? 'Produkt'),
      facts: {
        kcal: this.num(obj['kcal']),
        proteinG: this.num(obj['proteinG']),
        carbsG: this.num(obj['carbsG']),
        fatG: this.num(obj['fatG']),
        fiberG: this.num(obj['fiberG']),
        sugarG: this.num(obj['sugarG']),
        basis,
      },
    };
  }

  async suggestFastfood(req: FastFoodRequest): Promise<FastFoodSuggestion[]> {
    const sys =
      'Du empfiehlst Fastfood-Optionen. Antworte NUR mit JSON-Array: ' +
      '[{"restaurant":string,"itemName":string,"kcal":number,"proteinG":number,' +
      '"carbsG":number,"fatG":number,"rationale":string,"estPrice":number}]. ' +
      'Priorisiere proteinreiche Optionen mit gutem Verhältnis, bleibe im kcal-/Geld-Budget.';
    const user = JSON.stringify(req);
    const parsed = await this.callJsonRaw(sys, user, this.model(MODEL_LIGHT), 800);
    const arr = Array.isArray(parsed) ? parsed : (parsed['items'] as unknown[]) ?? [];
    return (arr as Record<string, unknown>[]).map((i) => ({
      restaurant: String(i['restaurant'] ?? req.restaurant),
      itemName: String(i['itemName'] ?? ''),
      facts: {
        kcal: this.num(i['kcal']),
        proteinG: this.num(i['proteinG']),
        carbsG: this.num(i['carbsG']),
        fatG: this.num(i['fatG']),
        basis: 'perPortion',
      },
      rationale: String(i['rationale'] ?? ''),
      estPrice: i['estPrice'] != null ? this.num(i['estPrice']) : undefined,
    }));
  }

  // --- intern ---

  private model(fallback: string): string {
    const m = this.settings.ai().model?.trim();
    return m && m.length > 0 ? m : fallback;
  }

  private num(v: unknown): number {
    const n = typeof v === 'number' ? v : Number(v);
    return Number.isFinite(n) ? n : 0;
  }

  /** JSON-Call mit reinem Text-User-Content. */
  private async callJson(
    system: string,
    userText: string,
    model: string,
    maxTokens: number,
  ): Promise<Record<string, unknown>> {
    return this.callJsonRaw(system, userText, model, maxTokens);
  }

  /** JSON-Call mit beliebigem Content (Text oder Vision-Blöcke). */
  private async callJsonRaw(
    system: string,
    content: unknown,
    model: string,
    maxTokens: number,
  ): Promise<Record<string, unknown> & unknown[]> {
    const cfg = this.settings.ai();
    if (!cfg.apiKey) throw new Error('Kein Claude-API-Key in den Einstellungen hinterlegt.');

    const endpoint = cfg.endpoint?.trim() || DEFAULT_ENDPOINT;
    const body = {
      model,
      max_tokens: maxTokens,
      system,
      messages: [{ role: 'user', content }],
    };
    const res = await firstValueFrom(
      this.http.post<AnthropicResponse>(endpoint, body, {
        headers: {
          'x-api-key': cfg.apiKey,
          'anthropic-version': '2023-06-01',
          'anthropic-dangerous-direct-browser-access': 'true',
          'content-type': 'application/json',
        },
      }),
    );
    const text = (res.content ?? [])
      .filter((b) => b.type === 'text')
      .map((b) => b.text ?? '')
      .join('\n');
    return this.extractJson(text);
  }

  /** Extrahiert das erste JSON-Objekt/-Array robust aus einer Modellantwort. */
  private extractJson(text: string): Record<string, unknown> & unknown[] {
    const trimmed = (text ?? '').trim().replace(/^```(?:json)?/i, '').replace(/```$/, '');
    try {
      return JSON.parse(trimmed);
    } catch {
      const match = trimmed.match(/[[{][\s\S]*[\]}]/);
      if (match) {
        try {
          return JSON.parse(match[0]);
        } catch {
          /* fällt unten durch */
        }
      }
      throw new Error('KI-Antwort war kein gültiges JSON.');
    }
  }
}
