import { HttpClient, HttpErrorResponse } from '@angular/common/http';
import { Injectable, inject } from '@angular/core';
import { firstValueFrom } from 'rxjs';
import {
  DailyTarget,
  FastFoodRequest,
  FastFoodSuggestion,
  NutritionBasis,
  NutritionFacts,
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

const DEFAULT_BASE = 'https://generativelanguage.googleapis.com/v1beta/models';
// Ein Modell für alles — Gemini 3.8 Flash ist multimodal (Text + Vision).
const MODEL_DEFAULT = 'gemini-3.8-flash';
// Einheiten, die 1:1 als Gramm/Milliliter gelten (→ Bezug per100g).
const GRAM_UNITS = new Set(['g', 'gramm', 'gr', 'ml', 'milliliter']);

interface GeminiPart {
  text?: string;
}
interface GeminiResponse {
  candidates?: { content?: { parts?: GeminiPart[] } }[];
}

/**
 * KI-Anbieter über die **Google Gemini API** (Generative Language API).
 * Key/Endpoint/Modell kommen aus den lokal gespeicherten Einstellungen
 * ({@link SettingsStore}). Standardmodell {@link MODEL_DEFAULT} (multimodal) —
 * ein in den Einstellungen gesetztes Modell überschreibt das. Alle Antworten
 * werden per `responseMimeType: application/json` als JSON erzwungen und
 * defensiv geparst (Schema-Guard).
 */
@Injectable({ providedIn: 'root' })
export class GeminiAiProvider implements AiProvider {
  private readonly http = inject(HttpClient);
  private readonly settings = inject(SettingsStore);

  async computeTargets(profile: UserProfile): Promise<DailyTarget> {
    const sys =
      'Du bist Ernährungsrechner. Antworte NUR mit JSON: ' +
      '{"kcal":number,"proteinG":number,"carbsG":number,"fatG":number,"fiberG":number,"sugarG":number}. ' +
      'Nutze Mifflin-St Jeor + Aktivitätsfaktor + Ziel-Anpassung. Keine Erklärung.';
    const user = `Profil: ${JSON.stringify(profile)}`;
    const obj = await this.callJson(sys, user, 400);
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
    const obj = await this.callJson(sys, user, 1500);
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
    const parts = [
      { inline_data: { mime_type: 'image/jpeg', data: imageBase64 } },
      { text: 'Lies die Nährwerte vom Etikett.' },
    ];
    const obj = await this.callJsonRaw(sys, parts, 500);
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
    const parsed = await this.callJsonRaw(sys, [{ text: user }], 800);
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

  async importRecipe(input: RecipeImportInput): Promise<RecipeImportResult> {
    const sys =
      'Du extrahierst Rezepte in strukturiertes JSON. Antworte NUR mit JSON: ' +
      '{"title":string,"servings":number,"ingredients":[{"name":string,"amount":number,"unit":string,' +
      '"facts":{"kcal":number,"proteinG":number,"carbsG":number,"fatG":number,"fiberG":number,"sugarG":number,' +
      '"basis":"per100g"|"perPortion","portionG":number}}],"steps":[string]}. ' +
      'Mengen als Zahl, Einheit getrennt (z.B. "g","ml","EL","Stk"). servings als Ganzzahl (Standard 2). ' +
      'Berechne für JEDE Zutat die Nährwerte (kcal + alle Makros): bei g/ml als Werte je 100 g (basis "per100g", ' +
      'portionG weglassen); bei Stück/Löffel/Zehe usw. als Werte für EINE Einheit (basis "perPortion", ' +
      'portionG = ungefähres Gewicht einer Einheit in g). Kennst du eine Zutat nicht, lass "facts" weg. ' +
      'Schreibe Zutaten und Schritte auf Deutsch. Keine Erklärung.';
    const user = input.text?.trim()
      ? `Rezept-Text:\n${input.text.trim()}`
      : `Hole und extrahiere das Rezept von dieser URL: ${input.url ?? ''}`;
    const obj = await this.callJson(sys, user, 2500);
    const ingredients = Array.isArray(obj['ingredients'])
      ? (obj['ingredients'] as Record<string, unknown>[]).map((i) => {
          const unit = String(i['unit'] ?? 'g').trim() || 'g';
          return {
            name: String(i['name'] ?? '').trim(),
            amount: this.num(i['amount']),
            unit,
            facts: this.parseIngredientFacts(i['facts'], unit),
          };
        })
      : [];
    const servings = Math.max(1, Math.round(this.num(obj['servings']) || 2));
    return {
      title: String(obj['title'] ?? 'Importiertes Rezept').trim() || 'Importiertes Rezept',
      servings,
      ingredients: ingredients.filter((i) => i.name),
      steps: Array.isArray(obj['steps']) ? (obj['steps'] as unknown[]).map(String) : [],
      sourceUrl: input.url,
    };
  }

  /** Parst die von der KI gelieferten Zutat-Nährwerte defensiv; Basis wird
   *  aus der Einheit abgeleitet, falls die KI keine gültige Basis liefert. */
  private parseIngredientFacts(raw: unknown, unit: string): NutritionFacts | undefined {
    if (!raw || typeof raw !== 'object') return undefined;
    const f = raw as Record<string, unknown>;
    const kcal = this.num(f['kcal']);
    const proteinG = this.num(f['proteinG']);
    const carbsG = this.num(f['carbsG']);
    const fatG = this.num(f['fatG']);
    // Reine Null-Werte (z.B. Wasser/Salz liefern 0) nur verwerfen, wenn ALLES 0 ist.
    if (kcal === 0 && proteinG === 0 && carbsG === 0 && fatG === 0) return undefined;

    const gramUnit = GRAM_UNITS.has(unit.toLowerCase());
    const rawBasis = String(f['basis'] ?? '');
    const basis: NutritionBasis =
      rawBasis === 'per100g' || rawBasis === 'perPortion'
        ? (rawBasis as NutritionBasis)
        : gramUnit
          ? 'per100g'
          : 'perPortion';
    const portionG = basis === 'perPortion' ? this.num(f['portionG']) || 50 : undefined;
    return {
      kcal,
      proteinG,
      carbsG,
      fatG,
      fiberG: this.num(f['fiberG']),
      sugarG: this.num(f['sugarG']),
      basis,
      portionG,
    };
  }

  // --- intern ---

  private model(): string {
    const m = this.settings.ai().model?.trim();
    return m && m.length > 0 ? m : MODEL_DEFAULT;
  }

  private num(v: unknown): number {
    const n = typeof v === 'number' ? v : Number(v);
    // Nährwerte und Preise sind nie negativ — defekte Modellwerte abfangen.
    return Number.isFinite(n) ? Math.max(0, n) : 0;
  }

  /** JSON-Call mit reinem Text-User-Content. */
  private async callJson(
    system: string,
    userText: string,
    maxTokens: number,
  ): Promise<Record<string, unknown>> {
    return this.callJsonRaw(system, [{ text: userText }], maxTokens);
  }

  /** JSON-Call mit beliebigen Gemini-`parts` (Text oder Vision). */
  private async callJsonRaw(
    system: string,
    parts: unknown[],
    maxTokens: number,
  ): Promise<Record<string, unknown> & unknown[]> {
    const cfg = this.settings.ai();
    if (!cfg.apiKey) throw new Error('Kein Gemini-API-Key in den Einstellungen hinterlegt.');

    const base = cfg.endpoint?.trim() || DEFAULT_BASE;
    const url = `${base}/${this.model()}:generateContent`;
    const body = {
      system_instruction: { parts: [{ text: system }] },
      contents: [{ role: 'user', parts }],
      generationConfig: { maxOutputTokens: maxTokens, responseMimeType: 'application/json', temperature: 0 },
    };
    const res = await this.postWithRetry(url, body, cfg.apiKey);
    const text = (res.candidates?.[0]?.content?.parts ?? [])
      .map((p) => p.text ?? '')
      .join('\n');
    return this.extractJson(text);
  }

  /**
   * POST mit Backoff-Retry bei transienten Gemini-Fehlern (503 überlastet,
   * 429 Rate-Limit, 500). Gemini liefert bei Last häufig 503 — ein paar
   * Wiederholungen mit wachsender Pause lösen das meist.
   */
  private async postWithRetry(
    url: string,
    body: unknown,
    apiKey: string,
    attempts = 3,
  ): Promise<GeminiResponse> {
    const headers = { 'x-goog-api-key': apiKey, 'content-type': 'application/json' };
    let lastErr: unknown;
    for (let i = 0; i < attempts; i++) {
      try {
        return await firstValueFrom(this.http.post<GeminiResponse>(url, body, { headers }));
      } catch (e: unknown) {
        lastErr = e;
        const status = e instanceof HttpErrorResponse ? e.status : 0;
        const transient = status === 503 || status === 429 || status === 500;
        if (!transient || i === attempts - 1) break;
        await new Promise((r) => setTimeout(r, 600 * (i + 1)));
      }
    }
    if (lastErr instanceof HttpErrorResponse && lastErr.status === 503) {
      throw new Error('Gemini ist gerade überlastet (503) — bitte in ein paar Sekunden erneut versuchen.');
    }
    throw lastErr;
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
