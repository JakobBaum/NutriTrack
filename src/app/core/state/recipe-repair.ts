/**
 * Reparatur gespeicherter Rezepte vor der Prüfung: Ein einzelner kaputter Wert (Nährwerte `null`, Menge `NaN`,
 * Portionen 0) darf nicht das ganze Rezept in die Quarantäne schicken. Rein, ändert die Eingabe nie.
 */
import { Rec, isFactsRecord, isNonNegative, isPositive, isRec } from '../util/guards';

const MIN_SERVINGS = 1;

export interface Repaired<T> {
  readonly value: T;
  readonly isRepaired: boolean;
}

function repairIngredient(raw: unknown): Repaired<unknown> {
  if (!isRec(raw)) return { value: raw, isRepaired: false };
  const hasBadFacts = raw['facts'] !== undefined && !isFactsRecord(raw['facts']);
  const hasBadAmount = 'amount' in raw && !isNonNegative(raw['amount']);
  // Eine Zutat ohne Menge-Feld bleibt unverändert und wird (strukturell unbrauchbar) vom Prüfer verworfen.
  if (!hasBadFacts && !hasBadAmount) return { value: raw, isRepaired: false };
  const { facts: _facts, ...rest } = raw;
  const base: Rec = hasBadFacts ? rest : raw;
  return { value: hasBadAmount ? { ...base, amount: 0 } : base, isRepaired: true };
}

function repairIngredients(raw: unknown): Repaired<unknown> {
  if (!Array.isArray(raw)) return { value: raw, isRepaired: false };
  const parts = raw.map(repairIngredient);
  return { value: parts.map((p) => p.value), isRepaired: parts.some((p) => p.isRepaired) };
}

/** Portionen: `null` (NaN nach JSON) oder eine Zahl, die nicht > 0 ist (0, negativ, NaN), wird zu 1; andere Nicht-Zahlen bleiben (strukturell unbrauchbar). */
const hasBadServings = (rec: Rec): boolean =>
  rec['servings'] === null || (typeof rec['servings'] === 'number' && !isPositive(rec['servings']));

/** Repariert ungültige Zutaten-Werte und Portionen; alles andere bleibt, wie es ist. */
export function repairRecipe(raw: unknown): Repaired<unknown> {
  if (!isRec(raw)) return { value: raw, isRepaired: false };
  const ingredients = repairIngredients(raw['ingredients']);
  const servingsBad = hasBadServings(raw);
  if (!ingredients.isRepaired && !servingsBad) return { value: raw, isRepaired: false };
  return {
    value: {
      ...raw,
      ...(ingredients.isRepaired ? { ingredients: ingredients.value } : {}),
      ...(servingsBad ? { servings: MIN_SERVINGS } : {}),
    },
    isRepaired: true,
  };
}
