import { describe, expect, it, beforeEach } from 'vitest';
import { TestBed } from '@angular/core/testing';
import { MockAiProvider } from './mock-ai-provider';

let provider: MockAiProvider;

beforeEach(() => {
  TestBed.resetTestingModule();
  TestBed.configureTestingModule({ providers: [MockAiProvider] });
  provider = TestBed.inject(MockAiProvider);
});

describe('MockAiProvider — importRecipe (Text-Parser)', () => {
  it('erkennt Titel, Zutaten mit Einheit und Schritte', async () => {
    // Arrange
    const text = [
      'Pfannkuchen',
      '250 g Mehl',
      '2 Eier',
      '500 ml Milch',
      'Alles verrühren und in der Pfanne backen.',
    ].join('\n');

    // Act
    const res = await provider.importRecipe({ text });

    // Assert
    expect(res.title).toBe('Pfannkuchen');
    expect(res.ingredients).toHaveLength(3);
    expect(res.ingredients[0]).toMatchObject({ name: 'Mehl', amount: 250, unit: 'g' });
    expect(res.ingredients[1]).toMatchObject({ name: 'Eier', amount: 2, unit: 'Stk' });
    expect(res.steps).toContain('Alles verrühren und in der Pfanne backen.');
  });

  it('schätzt Nährwerte für bekannte Zutaten (kcal + Makros) beim Import', async () => {
    // Arrange
    const text = ['Omelette', '3 Eier', '20 g Butter', '5 g Xyzpulver'].join('\n');

    // Act
    const res = await provider.importRecipe({ text });

    // Assert — bekannte Zutaten bekommen Nährwerte, unbekannte bleiben manuell
    const ei = res.ingredients.find((i) => i.name === 'Eier');
    expect(ei?.facts?.kcal).toBeGreaterThan(0);
    expect(ei?.facts?.proteinG).toBeGreaterThan(0);
    const unknown = res.ingredients.find((i) => i.name.startsWith('Xyzpulver'));
    expect(unknown?.facts).toBeUndefined();
  });

  it('gibt einen Platzhalter zurück, wenn nur eine URL angegeben ist', async () => {
    // Act
    const res = await provider.importRecipe({ url: 'https://example.com/rezept' });

    // Assert
    expect(res.ingredients).toHaveLength(0);
    expect(res.sourceUrl).toBe('https://example.com/rezept');
  });
});
