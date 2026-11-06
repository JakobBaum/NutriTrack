import { describe, expect, it } from 'vitest';
import { estimateIngredientFacts } from './ingredient-estimate';

// Randfälle der Offline-Nährwertschätzung (Namen, Einheiten).
describe('estimateIngredientFacts — Randfälle', () => {
  it('liefert undefined für leere oder fehlende Namen', () => {
    expect(estimateIngredientFacts('', 'g')).toBeUndefined();
    expect(estimateIngredientFacts(null as unknown as string, 'g')).toBeUndefined();
  });

  it('nimmt g als Standard bei leerer Einheit und ignoriert Groß-/Leerzeichen', () => {
    expect(estimateIngredientFacts('Milch', '')!.basis).toBe('per100g');
    expect(estimateIngredientFacts('Milch', 'ML')!.basis).toBe('per100g');
    expect(estimateIngredientFacts('Olivenöl', ' EL ')!.portionG).toBe(15);
  });

  it('liefert keine Schätzung für unbekannte Einheiten', () => {
    expect(estimateIngredientFacts('Milch', 'Becher')).toBeUndefined();
  });

  it('rechnet Dose (400 g) und Tasse (240 g) um', () => {
    const dose = estimateIngredientFacts('Tomaten', 'Dose')!;
    expect(dose.kcal).toBe(72);
    expect(dose.proteinG).toBe(3.6);
    const tasse = estimateIngredientFacts('Milch', 'Tasse')!;
    expect(tasse.kcal).toBe(154);
    expect(tasse.proteinG).toBe(8.2);
  });

  it('liefert für Salz/Wasser 0-Werte statt undefined', () => {
    const salz = estimateIngredientFacts('Salz', 'Prise')!;
    expect(salz.kcal).toBe(0);
    expect(salz.portionG).toBe(1);
  });

  // BUG: Teilstring-Treffer der Keywords „ei" und „ol" greifen zu früh.
  // ingredient-estimate.ts:94 (findDensity) + TABLE-Reihenfolge Z. 54/61.
  it('erkennt Reis nicht als Ei (Keyword „ei" in „Reis")', () => {
    // erwartet: 360 kcal (Reis), tatsächlich: 155 kcal (Ei)
    expect(estimateIngredientFacts('Reis', 'g')!.kcal).toBe(360);
  });

  it('erkennt Rindfleisch nicht als Ei (Keyword „ei" in „fleisch")', () => {
    // erwartet: 250 kcal (Rind), tatsächlich: 155 kcal (Ei)
    expect(estimateIngredientFacts('Rindfleisch', 'g')!.kcal).toBe(250);
  });

  it('erkennt Brokkoli nicht als Öl (Keyword „ol")', () => {
    // erwartet: undefined (unbekannt), tatsächlich: 884 kcal (Öl)
    expect(estimateIngredientFacts('Brokkoli', 'g')).toBeUndefined();
  });

  it('erkennt Komposita mit kurzen Keywords am Wortende', () => {
    expect(estimateIngredientFacts('Hühnerei', 'g')!.kcal).toBe(155);
    expect(estimateIngredientFacts('Olivenöl', 'g')!.kcal).toBe(884);
    expect(estimateIngredientFacts('Eier', 'g')!.kcal).toBe(155);
    expect(estimateIngredientFacts('Kartoffelbrei', 'g')!.kcal).toBe(77);
  });

  it.each([
    ['Eiswürfel'], ['Eisbergsalat'], ['Eiweißpulver'], ['Kokosmilch'], ['Mandelmilch'], ['Erdnussbutter'], ['Oliven'],
  ])('schätzt %s nicht als Ei/Milch/Butter/Öl', (name) => {
    expect(estimateIngredientFacts(name, 'g')).toBeUndefined();
  });

  it('erkennt „Ei“ und „Öl“ als ganzes Wort', () => {
    expect(estimateIngredientFacts('Ei', 'Stk')!.portionG).toBe(60);
    expect(estimateIngredientFacts('Öl', 'EL')!.kcal).toBe(133);
    expect(estimateIngredientFacts('Ol', 'g')!.kcal).toBe(884);
  });

  it('erkennt Buttermilch als Milch, Butter als Butter', () => {
    expect(estimateIngredientFacts('Buttermilch', 'ml')!.kcal).toBe(64);
    expect(estimateIngredientFacts('Butter', 'g')!.kcal).toBe(717);
  });

  it('liefert bei mehreren verschiedenen Treffern keine Schätzung', () => {
    expect(estimateIngredientFacts('Reis mit Hähnchen', 'g')).toBeUndefined();
  });

  it('nutzt die gemeinsame Gewichtstabelle (Stk 80, Zehe 5, Bund 50)', () => {
    expect(estimateIngredientFacts('Tomate', 'Stk')!.portionG).toBe(80);
    expect(estimateIngredientFacts('Knoblauch', 'Zehe')!.portionG).toBe(5);
    expect(estimateIngredientFacts('Zwiebel', 'Stk')!.portionG).toBe(80);
  });
});
