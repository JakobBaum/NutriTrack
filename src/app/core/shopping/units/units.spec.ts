import { describe, expect, it } from 'vitest';
import { densityOf } from './density';
import { toMetric } from './unit-convert';
import { formatIngredientLine, formatQuantity } from './unit-format';
import { convertStepText } from './unit-text';

describe('toMetric', () => {
  it('rechnet 2 pounds in rund 907 g', () => {
    expect(toMetric(2, 'pounds', 'Schweinefleisch')).toMatchObject({ amount: 907.2, unit: 'g' });
  });

  it('rechnet oz in g', () => {
    expect(toMetric(8, 'oz').amount).toBeCloseTo(226.8, 1);
  });

  it('lässt Flüssigkeiten in ml (1 cup Milch = 240 ml)', () => {
    expect(toMetric(1, 'cup', 'Milch')).toEqual({ amount: 240, unit: 'ml', approx: false });
  });

  it('nutzt die Dichte für Mehl (1 cup = ca. 127 g)', () => {
    expect(toMetric(1, 'cups', 'Mehl')).toEqual({ amount: 127.2, unit: 'g', approx: false });
  });

  it('markiert unbekannte Zutaten bei Volumenmaß als ungefähr (ml 1:1)', () => {
    expect(toMetric(2, 'cup', 'Mystery')).toEqual({ amount: 480, unit: 'ml', approx: true });
  });

  it('wandelt tbsp und tsp in EL und TL', () => {
    expect(toMetric(2, 'tbsp').unit).toBe('EL');
    expect(toMetric(1, 'tsp').unit).toBe('TL');
  });

  it('lässt metrische Einheiten unverändert', () => {
    expect(toMetric(200, 'g')).toEqual({ amount: 200, unit: 'g', approx: false });
  });
});

describe('densityOf', () => {
  it('kennt Mehl, Wasser (flüssig) und Unbekanntes', () => {
    expect(densityOf('Mehl').gPerMl).toBe(0.53);
    expect(densityOf('Wasser')).toEqual({ gPerMl: null, approx: false });
    expect(densityOf('Xyz').approx).toBe(true);
  });
});

describe('formatQuantity metrisch', () => {
  it('2 pounds Schweinefleisch ergibt 900 g', () => {
    const m = toMetric(2, 'pounds', 'Schweinefleisch');
    expect(formatIngredientLine(m.amount, m.unit, 'Schweinefleisch', 'metric')).toBe('900 g Schweinefleisch');
  });

  it('rundet kleine Mengen in 5er-Schritten', () => {
    expect(formatQuantity(47, 'g', 'x', 'metric')).toBe('45 g');
  });

  it('zeigt ab 1000 g Kilogramm', () => {
    expect(formatQuantity(1250, 'g', 'x', 'metric')).toBe('1,25 kg');
    expect(formatQuantity(1500, 'ml', 'x', 'metric')).toBe('1,5 l');
  });

  it('rechnet kg und l ohne Doppelrundung', () => {
    expect(formatQuantity(2, 'kg', 'x', 'metric')).toBe('2 kg');
  });

  it('lässt Zähleinheiten stehen', () => {
    expect(formatQuantity(0.5, 'Stk', 'Zwiebel', 'metric')).toBe('0,5 Stk');
    expect(formatQuantity(2, 'EL', 'Öl', 'metric')).toBe('2 EL');
  });

  it('rechnet US-Altdaten (lb) metrisch um', () => {
    expect(formatQuantity(1, 'lb', 'Rind', 'metric')).toBe('450 g');
  });

  it('Menge 0 zeigt nur die Einheit', () => {
    expect(formatQuantity(0, 'g', 'x', 'metric')).toBe('g');
  });
});

describe('formatQuantity imperial', () => {
  it('900 g werden zu lb', () => {
    expect(formatQuantity(900, 'g', 'x', 'imperial')).toBe('2 lb');
  });

  it('150 g werden zu oz', () => {
    expect(formatQuantity(150, 'g', 'x', 'imperial')).toBe('5 oz');
  });

  it('500 ml werden zu cups, 60 ml zu fl oz', () => {
    expect(formatQuantity(500, 'ml', 'x', 'imperial')).toBe('2 cups');
    expect(formatQuantity(60, 'ml', 'x', 'imperial')).toBe('2 fl oz');
  });

  it('EL und TL werden tbsp und tsp', () => {
    expect(formatQuantity(2, 'EL', 'Öl', 'imperial')).toBe('2 tbsp');
    expect(formatQuantity(1, 'TL', 'Salz', 'imperial')).toBe('1 tsp');
  });
});

describe('convertStepText', () => {
  it('350 degrees F wird 175 °C', () => {
    expect(convertStepText('Preheat oven to 350 degrees F.', 'metric')).toBe('Preheat oven to 175 °C.');
  });

  it('erkennt 350 F und 350°F', () => {
    expect(convertStepText('Bei 350 F backen', 'metric')).toBe('Bei 175 °C backen');
    expect(convertStepText('Bei 425°F backen', 'metric')).toBe('Bei 220 °C backen');
  });

  it('rechnet inch in cm um', () => {
    expect(convertStepText('in 1-inch Stücke schneiden', 'metric')).toBe('in 2,5 cm Stücke schneiden');
    expect(convertStepText('1/2 inch dick', 'metric')).toBe('1,5 cm dick');
  });

  it('imperial: °C wird °F', () => {
    expect(convertStepText('Bei 180 °C backen', 'imperial')).toBe('Bei 355 °F backen');
  });

  it('lässt Text ohne Maße unverändert', () => {
    expect(convertStepText('20 Minuten köcheln', 'metric')).toBe('20 Minuten köcheln');
  });
});
