import { NutritionFacts } from '../models';
import { macroKcal } from '../nutrition/recipe-nutrition';
import { MIN_KCAL_SHARE, MIN_KCAL_SLACK, isKcalBelowProtFat } from '../nutrition/kcal-consistency';

/**
 * Einzige Stelle für Plausibilitätsgrenzen von Nährwerten (OFF, KI, Etikett, Import, Spoonacular).
 * Reines Fett liefert rund 900 kcal je 100 g; mehr ist physikalisch nicht möglich.
 */
export const MAX_KCAL_PER_100G = 900;
export const MAX_GRAMS_PER_100G = 100;
/** Eine Portion oder Zutat-Gesamtmenge kann deutlich größer sein als 100 g. */
export const PORTION_MAX_KCAL = 5000;
export const PORTION_MAX_GRAMS = 1000;
/** Gesamtmenge einer Zutat im Rezept (z. B. 1,5 kg Mehl): deutlich größer als eine Portion. */
export const INGREDIENT_MAX_KCAL = 50000;
export const INGREDIENT_MAX_GRAMS = 10000;
/** Spielraum für gerundete Herstellerangaben bei der Summe aus Eiweiß, Kohlenhydraten und Fett. */
const MACRO_SUM_TOLERANCE_G = 5;

/** kcal darf um diesen Anteil von 4*Eiweiß + 4*KH + 9*Fett abweichen, bevor ein Wert als zweifelhaft gilt. */
export const ATWATER_TOLERANCE = 0.25;
/** Fester Spielraum je 100 g für Getränke und Gewürze mit winzigen Werten (Kaffee, Wasser). */
export const ATWATER_SLACK_PER_100G = 10;
/** Fester Spielraum je Portion (kleine Produkte, Rundung). */
export const ATWATER_SLACK_PER_PORTION = 25;

/** Ballaststoffe liefern rund 2 kcal je g. */
const FIBER_KCAL_PER_G = 2;
/** kcal darf die Makro-Energie höchstens um diesen Faktor übersteigen (dann gilt sie als sicher zu hoch). */
const KCAL_EXCESS_FACTOR = 1.5;

/** Ab dieser Makro-Energie lässt sich ein kJ-Wert im kcal-Feld über das Verhältnis erahnen (kJ = 4,184 mal kcal). */
const KJ_DETECT_MIN_MACRO_KCAL = 20;
const KJ_RATIO_MIN = 3.85;
const KJ_RATIO_MAX = 4.52;
/** Ab dieser kcal-Angabe gilt "kcal gleich kJ-Wert" als kJ im kcal-Feld (darunter ist die Verwechslung belanglos). */
const KJ_FIELD_MIN_KCAL = 20;
/** Zulässige Abweichung zwischen kcal-Feld und kJ-Wert, damit beide als "derselbe Wert" gelten. */
const KJ_FIELD_TOLERANCE = 0.1;
/** Alkohol liefert 7 kcal je g; mehr als 40 g je 100 g (rund 50 Vol.-%) ist als Erklärung unrealistisch. */
const ALCOHOL_KCAL_PER_G = 7;
const MAX_ALCOHOL_G_PER_100G = 40;
/** Nicht verwertbare Kohlenhydrate (Ballaststoffe, Polyole) liefern höchstens so viel kcal je g weniger als 4. */
const NON_DIGESTIBLE_KCAL_PER_G = 4;

/** Ergebnis der Energie-Prüfung: ok, "bitte prüfen" (zweifelhaft, aber möglich) oder sicher falsch. */
export type KcalVerdict = 'ok' | 'check' | 'wrong';

/** Zusatzangaben der Quelle, mit denen sich Abweichungen erklären oder entlarven lassen. */
export interface EnergyHints {
  /** Energie in kJ je 100 g, falls die Quelle sie getrennt angibt. */
  readonly kjPer100g?: number;
  /** Polyole (Zuckeraustauschstoffe) in g je 100 g. */
  readonly polyolsG?: number;
}

const inRange = (value: number | undefined, max: number): boolean =>
  value === undefined || (Number.isFinite(value) && value >= 0 && value <= max);

/**
 * True, wenn die Energie zweifelhaft ist; nur zum Markieren ("bitte prüfen"), nie zum Verwerfen.
 * Gleiches Regelwerk wie {@link assessKcal} (Ballaststoffe, Polyole, kJ-Verhältnis); zusätzlich gilt ein Überschuss
 * über die Makro-Energie erst als zweifelhaft, wenn Alkohol ihn nicht erklären kann (Makro-Energie unter 20 kcal).
 */
export function isAtwaterDoubtful(facts: NutritionFacts, slackKcal: number): boolean {
  if (assessKcal(facts) !== 'ok') return true;
  const macroOnly = macroKcal(facts);
  // Ballaststoffe liefern rund 2 kcal je g und gehören nicht zur 4/4/9-Rechnung.
  const expected = macroOnly + FIBER_KCAL_PER_G * (facts.fiberG ?? 0);
  const excess = facts.kcal - expected;
  if (excess <= expected * ATWATER_TOLERANCE + slackKcal) return false;
  // Alkohol erklärt den Überschuss nur bei teilweise vorhandenen, kaum nennenswerten Makros (Wein, Bier, Spirituosen);
  // komplett fehlende Makros bei spürbaren kcal (KI-Ergebnis "Pizza 250 kcal, 0/0/0") bleiben zweifelhaft.
  const isAlcoholLike = macroOnly > 0 && macroOnly < KJ_DETECT_MIN_MACRO_KCAL && isAlcoholExplainable(facts.kcal, macroOnly);
  return !isAlcoholLike;
}

/**
 * True, wenn kcal die Energie aus Eiweiß, Kohlenhydraten, Fett (4/4/9) und Ballaststoffen (2) deutlich übersteigt:
 * mehr als Faktor {@link KCAL_EXCESS_FACTOR} plus Spielraum. Für Quellen ohne Alkohol-Fall (Fastfood, KI-Portionen),
 * bei denen ein Überschuss ein Fehler ist und nicht nur ein Hinweis; Makros 0/0/0 mit spürbaren kcal fallen ebenfalls darunter.
 */
export function isKcalFarAboveMacros(facts: NutritionFacts, slackKcal: number = ATWATER_SLACK_PER_PORTION): boolean {
  const expected = macroKcal(facts) + FIBER_KCAL_PER_G * (facts.fiberG ?? 0);
  return facts.kcal > expected * KCAL_EXCESS_FACTOR + slackKcal;
}

/** kcal steht im kcal-Feld, aber der getrennt gelieferte kJ-Wert ist (etwa) derselbe Zahlenwert: kJ im kcal-Feld. */
function isKjInKcalField(kcal: number, kj: number | undefined): boolean {
  if (kj === undefined || !(kj > 0) || kcal < KJ_FIELD_MIN_KCAL) return false;
  return Math.abs(kcal - kj) <= kj * KJ_FIELD_TOLERANCE;
}

/** True, wenn Alkohol den Überschuss über die Makro-Energie erklären kann (Wein, Bier, Spirituosen). */
function isAlcoholExplainable(kcal: number, expected: number): boolean {
  return (kcal - expected) / ALCOHOL_KCAL_PER_G <= MAX_ALCOHOL_G_PER_100G;
}

/** kcal liegt unter der Makro-Energie, und Ballaststoffe/Polyole erklären die Lücke nicht (z. B. Erythrit ohne Angabe). */
function hasUnexplainedCarbGap(facts: NutritionFacts, polyolsG: number): boolean {
  const expected = macroKcal(facts);
  if (facts.kcal >= expected * MIN_KCAL_SHARE - MIN_KCAL_SLACK) return false;
  const nonDigestibleG = Math.min(facts.carbsG, (facts.fiberG ?? 0) + polyolsG);
  const adjusted = expected - NON_DIGESTIBLE_KCAL_PER_G * nonDigestibleG;
  return facts.kcal < adjusted * MIN_KCAL_SHARE - MIN_KCAL_SLACK;
}

/**
 * Bewertet die Energie je 100 g. "wrong" nur bei sicherem Fehler: kcal klar unter der Energie von Eiweiß und Fett,
 * oder der getrennt gelieferte kJ-Wert steht im kcal-Feld. Alles Zweifelhafte (Lücke nur bei Kohlenhydraten: Erythrit,
 * Kaugummi, Flohsamen; kcal etwa 4,2 mal die Makro-Energie ab rund 20 kcal Makro-Energie, ohne kJ-Wert) ist "check":
 * nicht verwerfen, sondern "bitte prüfen" markieren. Alkohol erklärt nur Werte außerhalb dieses Verhältnisses oder bei
 * Makro-Energie unter 20 kcal (Spirituosen, trockener Wein, Bier); Olivenöl (884 kcal) bleibt "ok".
 */
export function assessKcal(facts: NutritionFacts, hints: EnergyHints = {}): KcalVerdict {
  if (isKcalBelowProtFat(facts) || isKjInKcalField(facts.kcal, hints.kjPer100g)) return 'wrong';
  if (hasUnexplainedCarbGap(facts, hints.polyolsG ?? 0)) return 'check';
  const expected = macroKcal(facts);
  if (expected < KJ_DETECT_MIN_MACRO_KCAL) return 'ok';
  const ratio = facts.kcal / expected;
  // kJ-typisches Verhältnis bei spürbarer Makro-Energie: immer prüfen, auch wenn Alkohol rechnerisch passen würde.
  return ratio >= KJ_RATIO_MIN && ratio <= KJ_RATIO_MAX ? 'check' : 'ok';
}

/** True bei KLAR falscher Energie (siehe {@link assessKcal}). */
export function isKcalClearlyWrong(facts: NutritionFacts, hints: EnergyHints = {}): boolean {
  return assessKcal(facts, hints) === 'wrong';
}

/** Harte Grenzen je 100 g (ohne Energie-Abgleich): Wertebereiche und Summe der Makros. */
export function isWithinPer100gLimits(facts: NutritionFacts): boolean {
  const grams = [facts.proteinG, facts.carbsG, facts.fatG, facts.fiberG, facts.sugarG, facts.saltG];
  if (!inRange(facts.kcal, MAX_KCAL_PER_100G)) return false;
  if (!grams.every((g) => inRange(g, MAX_GRAMS_PER_100G))) return false;
  return facts.proteinG + facts.carbsG + facts.fatG <= MAX_GRAMS_PER_100G + MACRO_SUM_TOLERANCE_G;
}

/** Harte Grenzen je Portion bzw. Zutat-Menge. */
export function isWithinPortionLimits(facts: NutritionFacts): boolean {
  const grams = [facts.proteinG, facts.carbsG, facts.fatG, facts.fiberG, facts.sugarG, facts.saltG];
  return inRange(facts.kcal, PORTION_MAX_KCAL) && grams.every((g) => inRange(g, PORTION_MAX_GRAMS));
}

/** Harte Grenzen für die Gesamtmenge einer Zutat. */
export function isWithinIngredientLimits(facts: NutritionFacts): boolean {
  const grams = [facts.proteinG, facts.carbsG, facts.fatG, facts.fiberG, facts.sugarG, facts.saltG];
  return inRange(facts.kcal, INGREDIENT_MAX_KCAL) && grams.every((g) => inRange(g, INGREDIENT_MAX_GRAMS));
}

/**
 * Prüft Nährwerte je 100 g aus maschinellen Quellen (z. B. Open Food Facts) auf harte Grenzen und klar falsche
 * Energie. Offensichtlich falsche Einträge dürfen nicht ins Tagebuch gelangen.
 */
export function isPlausiblePer100g(facts: NutritionFacts, hints: EnergyHints = {}): boolean {
  return isWithinPer100gLimits(facts) && !isKcalClearlyWrong(facts, hints);
}
