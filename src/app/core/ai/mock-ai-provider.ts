import { Injectable, inject } from '@angular/core';
import {
  DailyTarget,
  FastFoodRequest,
  FastFoodSuggestion,
  UserProfile,
} from '../models';
import { NutritionCalcService } from '../nutrition/nutrition-calc.service';
import { estimateIngredientFacts } from '../nutrition/ingredient-estimate';
import { buildWeekPlan } from '../shopping/shopping-generator';
import {
  AiProvider,
  LabelResult,
  RecipeImportInput,
  RecipeImportResult,
  ShoppingPlanRequest,
  ShoppingPlanResult,
} from './ai-provider';

/** Erkennt "250 g Mehl", "2 EL Öl", "1 Zwiebel" am Zeilenanfang. */
const INGREDIENT_RE = /^\s*(\d+(?:[.,]\d+)?)\s*([a-zA-ZäöüÄÖÜ.]+)?\s+(.+)$/;
// Zeitwörter nach einer Zahl („10 Minuten köcheln“) sind Schritte, keine Zutaten.
const STEP_WORDS = new Set(['minute', 'minuten', 'min', 'sekunden', 'sek', 'stunde', 'stunden', 'std', 'grad', 'schritt', 'personen', 'portionen']);
const UNITS = new Set([
  'g', 'kg', 'mg', 'ml', 'l', 'el', 'tl', 'stk', 'stück', 'prise', 'prisen',
  'packung', 'dose', 'dosen', 'bund', 'zehe', 'zehen', 'scheibe', 'scheiben', 'tasse', 'tassen',
]);

/** Schreibweisen aus Rezepttexten -> Einheit aus der App-Auswahl (UNIT_OPTIONS). */
const UNIT_ALIASES: Readonly<Record<string, string>> = {
  g: 'g', kg: 'kg', ml: 'ml', l: 'l', el: 'EL', tl: 'TL', stk: 'Stk', stück: 'Stk',
  prise: 'Prise', prisen: 'Prise', packung: 'Pck', dose: 'Dose', dosen: 'Dose', bund: 'Bund',
};

/** Behält die erkannte Einheit bei (z. B. „EL“); Unbekanntes bleibt klein und wird im Import-Review markiert. */
export function canonicalUnit(raw: string): string {
  const key = raw.toLowerCase().replace('.', '');
  return UNIT_ALIASES[key] ?? key;
}

/**
 * Deterministischer KI-Anbieter für Entwicklung/Tests — **ohne Netzwerk, ohne Kosten**.
 * Liefert plausible, nachvollziehbare Ergebnisse, damit alle KI-Flows ohne echten
 * Key bedienbar und testbar sind.
 */
@Injectable({ providedIn: 'root' })
export class MockAiProvider implements AiProvider {
  private readonly calc = inject(NutritionCalcService);

  async computeTargets(profile: UserProfile): Promise<DailyTarget> {
    // Mock = deterministische Fallback-Formel.
    return this.calc.dailyTarget(profile);
  }

  async generateShoppingList(req: ShoppingPlanRequest): Promise<ShoppingPlanResult> {
    const plan = buildWeekPlan(req.recipes, req.persons, req.days, req.meals.length);
    // Ehrlich ohne KI: nur Mengen, keine erfundenen Preise.
    return { items: plan.items, suggestedDishes: plan.suggestedDishes, estTotal: 0 };
  }

  async recognizeLabel(
    _imageBase64: string,
    basis: 'per100g' | 'perPortion',
  ): Promise<LabelResult> {
    // Deterministischer Platzhalter-Nährwert (z.B. Müsliriegel).
    return {
      name: 'Erkanntes Produkt (Mock)',
      facts: {
        kcal: basis === 'per100g' ? 380 : 150,
        proteinG: basis === 'per100g' ? 8 : 3,
        carbsG: basis === 'per100g' ? 60 : 24,
        fatG: basis === 'per100g' ? 10 : 4,
        fiberG: basis === 'per100g' ? 6 : 2,
        sugarG: basis === 'per100g' ? 20 : 8,
        basis,
        portionG: basis === 'perPortion' ? 40 : undefined,
      },
    };
  }

  async suggestFastfood(req: FastFoodRequest): Promise<FastFoodSuggestion[]> {
    const r = req.restaurant || 'Fastfood';
    const base: FastFoodSuggestion[] = [
      {
        restaurant: r,
        itemName: 'Grilled Chicken (ohne Mayo)',
        facts: { kcal: 350, proteinG: 37, carbsG: 30, fatG: 8, basis: 'perPortion' },
        rationale: 'Sehr proteinreich bei moderaten Kalorien — bestes Verhältnis.',
        estPrice: 6.5,
      },
      {
        restaurant: r,
        itemName: 'Doppel-Hamburger',
        facts: { kcal: 440, proteinG: 25, carbsG: 34, fatG: 23, basis: 'perPortion' },
        rationale: 'Viel Protein fürs Geld, passt meist ins kcal-Budget.',
        estPrice: 4.0,
      },
      {
        restaurant: r,
        itemName: 'Hähnchen-Wrap',
        facts: { kcal: 300, proteinG: 20, carbsG: 28, fatG: 10, basis: 'perPortion' },
        rationale: 'Leichter Snack mit solidem Proteinanteil.',
        estPrice: 3.5,
      },
    ];
    // Beide Budgets strikt einhalten; kein Treffer -> leere Liste (UI zeigt Leerzustand).
    const within = base.filter(
      (s) =>
        (req.kcalBudget == null || s.facts.kcal <= req.kcalBudget) &&
        (!req.moneyBudget || (s.estPrice ?? 0) <= req.moneyBudget),
    );
    // Nach Protein/kcal-Verhältnis sortieren (proteinreichste zuerst).
    return within.sort(
      (a, b) => b.facts.proteinG / b.facts.kcal - a.facts.proteinG / a.facts.kcal,
    );
  }

  /**
   * Parst eingefügten Rezept-Text deterministisch (ohne Netzwerk). Zutaten-Zeilen
   * werden per Muster erkannt, der Rest wird als Zubereitungsschritte behandelt.
   * URL/Foto ohne Text und Texte ohne Zutaten werfen einen Fehler (nie ein leeres Rezept).
   */
  async importRecipe(input: RecipeImportInput): Promise<RecipeImportResult> {
    // Ehrlich: Der Mock kann weder Seiten abrufen noch Bilder lesen und erfindet nichts.
    if (input.imageBase64) throw new Error('Foto-Import braucht eine KI-Verbindung.');
    const text = (input.text ?? '').trim();
    if (!text) {
      throw new Error(input.url ? 'Link-Import braucht eine KI-Verbindung. Füge den Rezept-Text ein.' : 'Kein Rezept-Text angegeben.');
    }

    const lines = text
      .split('\n')
      .map((l) => l.trim())
      .filter(Boolean);
    const title = lines[0] ?? 'Importiertes Rezept';
    const body = lines.slice(1);

    const ingredients: RecipeImportResult['ingredients'] = [];
    const steps: string[] = [];
    for (const line of body) {
      const m = INGREDIENT_RE.exec(line);
      const hasUnit = m && m[2] && UNITS.has(m[2].toLowerCase().replace('.', ''));
      const unknownUnitWord = !!m && !!m[2] && !hasUnit && !STEP_WORDS.has(m[2].toLowerCase());
      if (m && (hasUnit || !m[2] || unknownUnitWord)) {
        const amount = Number(m[1].replace(',', '.'));
        const unit = hasUnit ? canonicalUnit(m[2]!) : 'Stk';
        // Unbekanntes Einheitswort (z. B. „Becher“) bleibt Teil des Namens.
        const name = (unknownUnitWord ? `${m[2]} ${m[3]}` : m[3]).trim();
        ingredients.push({
          name,
          amount: Number.isFinite(amount) ? amount : 0,
          unit,
          // Bekannte Zutaten direkt mit Nährwerten (statt KI); sonst manuell.
          facts: estimateIngredientFacts(name, unit),
        });
      } else {
        steps.push(line);
      }
    }

    if (ingredients.length === 0) throw new Error('Keine Zutaten erkannt. Zutaten brauchen eine Menge, z. B. „250 g Mehl“.');

    return {
      title,
      servings: 2,
      ingredients,
      steps,
      sourceUrl: input.url,
    };
  }
}
