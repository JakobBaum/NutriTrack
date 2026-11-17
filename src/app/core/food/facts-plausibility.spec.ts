import {
  MAX_GRAMS_PER_100G, MAX_KCAL_PER_100G, PORTION_MAX_GRAMS, PORTION_MAX_KCAL, assessKcal, isAtwaterDoubtful, isPlausiblePer100g,
} from './facts-plausibility';
import { NutritionFacts } from '../models';

const facts = (over: Partial<NutritionFacts> = {}): NutritionFacts => ({
  kcal: 250, proteinG: 10, carbsG: 30, fatG: 8, basis: 'per100g', ...over,
});

describe('isPlausiblePer100g', () => {
  it('akzeptiert übliche Werte', () => {
    expect(isPlausiblePer100g(facts())).toBe(true);
  });

  it('akzeptiert reines Fett (900 kcal, 100 g Fett)', () => {
    expect(isPlausiblePer100g(facts({ kcal: 900, proteinG: 0, carbsG: 0, fatG: 100 }))).toBe(true);
  });

  it('verwirft mehr Kalorien, als 100 g Fett liefern können', () => {
    expect(isPlausiblePer100g(facts({ kcal: 9999 }))).toBe(false);
  });

  it('verwirft einen Makrowert über 100 g je 100 g', () => {
    expect(isPlausiblePer100g(facts({ proteinG: 250 }))).toBe(false);
  });

  it('verwirft eine Makrosumme deutlich über 100 g', () => {
    expect(isPlausiblePer100g(facts({ proteinG: 60, carbsG: 60, fatG: 20 }))).toBe(false);
  });

  it('verwirft Zucker oder Ballaststoffe über 100 g', () => {
    expect(isPlausiblePer100g(facts({ sugarG: 400 }))).toBe(false);
    expect(isPlausiblePer100g(facts({ fiberG: 101 }))).toBe(false);
  });

  it('verwirft nicht endliche Werte', () => {
    expect(isPlausiblePer100g(facts({ kcal: Number.NaN }))).toBe(false);
    expect(isPlausiblePer100g(facts({ fatG: Number.POSITIVE_INFINITY }))).toBe(false);
  });

  it('lässt kleine Rundungsüberschreitungen der Makrosumme zu', () => {
    expect(isPlausiblePer100g(facts({ kcal: 400, proteinG: 1, carbsG: 99.8, fatG: 0.5 }))).toBe(true);
  });
});

describe('isPlausiblePer100g — Energie gegen Makros (K4)', () => {
  it('verwirft kcal, die klar unter der Makro-Energie liegen (kcal 0 bei vollen Makros)', () => {
    expect(isPlausiblePer100g(facts({ kcal: 0, proteinG: 10, carbsG: 30, fatG: 8 }))).toBe(false);
    expect(isPlausiblePer100g(facts({ kcal: 60, proteinG: 10, carbsG: 30, fatG: 8 }))).toBe(false);
  });

  it('verwirft einen kJ-Wert im kcal-Feld, wenn der kJ-Wert denselben Zahlenwert hat', () => {
    // 10 g Eiweiß, 30 g KH, 8 g Fett = 232 kcal = 971 kJ → über 900 kcal wäre eh falsch; kleinere Beispiele:
    expect(isPlausiblePer100g(facts({ kcal: 418, proteinG: 5, carbsG: 15, fatG: 2 }), { kjPer100g: 418 })).toBe(false);
  });

  it('lässt Sonderfälle zu, bei denen kcal über den Makros liegt (Alkohol, Ballaststoffe, Polyole)', () => {
    expect(isPlausiblePer100g(facts({ kcal: 230, proteinG: 0, carbsG: 0, fatG: 0 }))).toBe(true);
    expect(isPlausiblePer100g(facts({ kcal: 300, proteinG: 10, carbsG: 30, fatG: 8 }))).toBe(true);
    expect(isPlausiblePer100g(facts({ kcal: 40, proteinG: 0.5, carbsG: 5, fatG: 0.2 }))).toBe(true);
  });

  it('lässt Wasser und Gewürze mit winzigen Werten zu', () => {
    expect(isPlausiblePer100g(facts({ kcal: 0, proteinG: 0, carbsG: 0, fatG: 0 }))).toBe(true);
    expect(isPlausiblePer100g(facts({ kcal: 1, proteinG: 0.1, carbsG: 0.2, fatG: 0 }))).toBe(true);
  });
});

describe('Plausibilitätsgrenzen an einer Stelle', () => {
  it('nennt die Grenzen je 100 g und je Portion als Konstanten', () => {
    expect(MAX_KCAL_PER_100G).toBe(900);
    expect(MAX_GRAMS_PER_100G).toBe(100);
    expect(PORTION_MAX_KCAL).toBe(5000);
    expect(PORTION_MAX_GRAMS).toBe(1000);
  });

  it('isAtwaterDoubtful markiert Abweichungen über 25 % plus Spielraum', () => {
    expect(isAtwaterDoubtful(facts({ kcal: 232 }), 10)).toBe(false);
    expect(isAtwaterDoubtful(facts({ kcal: 500 }), 10)).toBe(true);
  });

  it('isAtwaterDoubtful markiert Wein, Bier und Wodka nicht (gleiche Regel wie assessKcal)', () => {
    const drink = (kcal: number, p: number, c: number): NutritionFacts => ({ kcal, proteinG: p, carbsG: c, fatG: 0, basis: 'per100g' });
    expect(isAtwaterDoubtful(drink(80, 0.1, 2.6), 10)).toBe(false);
    expect(isAtwaterDoubtful(drink(43, 0.5, 3.6), 10)).toBe(false);
  });

  it('isAtwaterDoubtful: Wodka (0/0/0, 231 kcal) wird nur als "bitte prüfen" markiert, assessKcal verwirft ihn nicht', () => {
    const vodka: NutritionFacts = { kcal: 231, proteinG: 0, carbsG: 0, fatG: 0, basis: 'per100g' };
    expect(isAtwaterDoubtful(vodka, 10)).toBe(true);
    expect(assessKcal(vodka)).toBe('ok');
    expect(isPlausiblePer100g(vodka)).toBe(true);
  });

  it('isAtwaterDoubtful: Gericht ohne Makros mit kcal (Pizza 250 kcal, 0/0/0) ist zweifelhaft', () => {
    const pizza: NutritionFacts = { kcal: 250, proteinG: 0, carbsG: 0, fatG: 0, basis: 'perPortion' };
    expect(isAtwaterDoubtful(pizza, 25)).toBe(true);
  });

  it('isAtwaterDoubtful: Wasser und Cola Zero ohne Makros bleiben unmarkiert', () => {
    expect(isAtwaterDoubtful({ kcal: 0, proteinG: 0, carbsG: 0, fatG: 0, basis: 'per100g' }, 10)).toBe(false);
    expect(isAtwaterDoubtful({ kcal: 1, proteinG: 0, carbsG: 0, fatG: 0, basis: 'per100g' }, 10)).toBe(false);
  });

  it('isAtwaterDoubtful: Ballaststoffe (ca. 2 kcal/g) erklären Überschuss (Flohsamen, Chia)', () => {
    const psyllium: NutritionFacts = { kcal: 170, proteinG: 2, carbsG: 5, fatG: 0.5, fiberG: 85, basis: 'per100g' };
    const chia: NutritionFacts = { kcal: 486, proteinG: 17, carbsG: 7, fatG: 31, fiberG: 34, basis: 'per100g' };
    expect(isAtwaterDoubtful(psyllium, 10)).toBe(false);
    expect(isAtwaterDoubtful(chia, 10)).toBe(false);
  });

  it('isAtwaterDoubtful: Süßer Likör (327 kcal, KH 25, Fett 13) bleibt markiert', () => {
    expect(isAtwaterDoubtful({ kcal: 327, proteinG: 0, carbsG: 25, fatG: 13, basis: 'per100g' }, 10)).toBe(true);
  });

  it('isAtwaterDoubtful berücksichtigt Ballaststoffe (Flohsamen)', () => {
    const psyllium: NutritionFacts = { kcal: 20, proteinG: 2, carbsG: 85, fatG: 0.5, fiberG: 80, basis: 'per100g' };
    expect(isAtwaterDoubtful(psyllium, 10)).toBe(false);
  });
});

describe('assessKcal (Prüfrunde 2)', () => {
  const f = (kcal: number, p: number, c: number, fat: number, fiberG?: number): NutritionFacts =>
    ({ kcal, proteinG: p, carbsG: c, fatG: fat, ...(fiberG === undefined ? {} : { fiberG }), basis: 'per100g' });

  it('Wein (2,6 g KH, 80 kcal): Makro-Energie unter 20 kcal, Alkohol erklärt die Energie, ok', () => {
    expect(assessKcal(f(80, 0.1, 2.6, 0))).toBe('ok');
    expect(isPlausiblePer100g(f(80, 0.1, 2.6, 0))).toBe(true);
  });

  it('Wein mit 5 g KH und 80 kcal passt zum kJ-Verhältnis: nur prüfen (nicht verwerfen), weil kJ nicht zu unterscheiden ist', () => {
    expect(assessKcal(f(80, 0.1, 5, 0))).toBe('check');
    expect(isPlausiblePer100g(f(80, 0.1, 5, 0))).toBe(true);
  });

  it('Apfelsaft mit kJ im kcal-Feld (192 statt 46 kcal) wird trotz möglichem Alkohol markiert', () => {
    expect(assessKcal(f(192, 0.1, 10.5, 0.1))).toBe('check');
    expect(assessKcal(f(192, 0.5, 10, 0.1))).toBe('check');
  });

  it('Joghurt mit kJ im kcal-Feld (259 statt 62 kcal) wird markiert', () => {
    expect(assessKcal(f(259, 3.5, 4.7, 3.5))).toBe('check');
  });

  it('echter Apfelsaft (46 kcal) und Joghurt (62 kcal) bleiben ok', () => {
    expect(assessKcal(f(46, 0.1, 10.5, 0.1))).toBe('ok');
    expect(assessKcal(f(62, 3.5, 4.7, 3.5))).toBe('ok');
  });

  it('Bier und Spirituose bleiben ok', () => {
    expect(assessKcal(f(43, 0.5, 3.6, 0))).toBe('ok');
    expect(assessKcal(f(231, 0, 0, 0))).toBe('ok');
  });

  it('Olivenöl 884 kcal und Wasser 0 kcal bleiben ok', () => {
    expect(assessKcal(f(884, 0, 0, 100))).toBe('ok');
    expect(assessKcal(f(0, 0, 0, 0))).toBe('ok');
  });

  it('kJ im kcal-Feld ohne kJ-Wert wird nur markiert, nicht verworfen', () => {
    expect(assessKcal(f(418, 5, 15, 2))).toBe('check');
    expect(isPlausiblePer100g(f(418, 5, 15, 2))).toBe(true);
  });

  it('kJ im kcal-Feld mit gleichem kJ-Wert wird verworfen', () => {
    expect(assessKcal(f(418, 5, 15, 2), { kjPer100g: 418 })).toBe('wrong');
    expect(isPlausiblePer100g(f(418, 5, 15, 2), { kjPer100g: 418 })).toBe(false);
  });

  it('ein korrekter kJ-Wert (4,184 mal kcal) macht kcal nicht falsch', () => {
    expect(assessKcal(f(100, 5, 15, 2), { kjPer100g: 418 })).toBe('ok');
  });

  it('Erythrit (100 g KH, 0 kcal) wird markiert statt verworfen; Polyole erklären die Lücke', () => {
    expect(assessKcal(f(0, 0, 100, 0))).toBe('check');
    expect(isPlausiblePer100g(f(0, 0, 100, 0))).toBe(true);
    expect(assessKcal(f(0, 0, 100, 0), { polyolsG: 100 })).toBe('ok');
  });

  it('Flohsamenschalen (Ballaststoffe erklären die Lücke) bleiben ok', () => {
    expect(assessKcal(f(20, 2, 85, 0.5, 80))).toBe('ok');
  });

  it('kcal 0 bei Eiweiß/Fett bleibt sicher falsch', () => {
    expect(assessKcal(f(0, 20, 10, 50))).toBe('wrong');
  });
});
