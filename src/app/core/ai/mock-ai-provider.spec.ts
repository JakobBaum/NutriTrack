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
    expect(res.ingredients[0]).toEqual({ name: 'Mehl', amount: 250, unit: 'g' });
    expect(res.ingredients[1]).toEqual({ name: 'Eier', amount: 2, unit: 'Stk' });
    expect(res.steps).toContain('Alles verrühren und in der Pfanne backen.');
  });

  it('gibt einen Platzhalter zurück, wenn nur eine URL angegeben ist', async () => {
    // Act
    const res = await provider.importRecipe({ url: 'https://example.com/rezept' });

    // Assert
    expect(res.ingredients).toHaveLength(0);
    expect(res.sourceUrl).toBe('https://example.com/rezept');
  });
});
