import { describe, expect, it } from 'vitest';
import { estimateIngredientFacts } from './ingredient-estimate';

describe('estimateIngredientFacts', () => {
  it('liefert Dichte je 100 g bei Gramm-Einheit', () => {
    // Arrange / Act
    const facts = estimateIngredientFacts('Mehl', 'g');

    // Assert
    expect(facts).toBeDefined();
    expect(facts!.basis).toBe('per100g');
    expect(facts!.kcal).toBe(364);
    expect(facts!.proteinG).toBe(10);
  });

  it('erkennt Zutaten unabhängig von Groß-/Kleinschreibung und Zusätzen', () => {
    const facts = estimateIngredientFacts('Vollkorn-MEHL Type 1050', 'g');
    expect(facts?.kcal).toBe(364);
  });

  it('rechnet Stück-Einheiten auf eine Einheit um (basis perPortion)', () => {
    // Act — 1 Ei ~ 50 g
    const facts = estimateIngredientFacts('Eier', 'Stk');

    // Assert
    expect(facts).toBeDefined();
    expect(facts!.basis).toBe('perPortion');
    expect(facts!.portionG).toBe(50);
    // 155 kcal/100 g * 0.5 = ~78 kcal je Ei
    expect(facts!.kcal).toBe(78);
  });

  it('nutzt Einheitsgewichte für EL/TL', () => {
    // 1 EL Öl ~ 15 g → 884 * 0.15 = ~133 kcal
    const facts = estimateIngredientFacts('Olivenöl', 'EL');
    expect(facts!.basis).toBe('perPortion');
    expect(facts!.portionG).toBe(15);
    expect(facts!.kcal).toBe(133);
  });

  it('gibt undefined für unbekannte Zutaten zurück', () => {
    expect(estimateIngredientFacts('Spezialpulver XY', 'g')).toBeUndefined();
  });
});
