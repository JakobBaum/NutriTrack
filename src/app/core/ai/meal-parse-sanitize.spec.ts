import { describe, expect, it } from 'vitest';
import { MAX_MEAL_ITEMS } from './meal-parse';
import { sanitizeMealParse } from './meal-parse-sanitize';

const wire = (over: Record<string, unknown> = {}) => ({
  name: 'Semmel',
  amount: 2,
  unit: 'Stk',
  portionG: 100,
  per100g: { kcal: 280, proteinG: 9, carbsG: 55, fatG: 1.5 },
  ...over,
});
const response = (...items: unknown[]) => ({ items });

describe('sanitizeMealParse', () => {
  it('übernimmt eine gültige Zeile mit per100g im App-Format', () => {
    const result = sanitizeMealParse(response(wire()));
    expect(result.droppedCount).toBe(0);
    expect(result.items).toEqual([{
      name: 'Semmel', amount: 2, unit: 'Stk', portionG: 100, isKcalDoubtful: false,
      per100g: { kcal: 280, proteinG: 9, carbsG: 55, fatG: 1.5, basis: 'per100g' },
    }]);
  });

  it('wirft unbekannte Felder weg', () => {
    const [item] = sanitizeMealParse(response(wire({ evil: 'x', per100g: { kcal: 280, proteinG: 9, carbsG: 55, fatG: 1.5, fiberG: 3, extra: 1 } }))).items;
    expect(Object.keys(item).sort()).toEqual(['amount', 'isKcalDoubtful', 'name', 'per100g', 'portionG', 'unit']);
    expect(Object.keys(item.per100g).sort()).toEqual(['basis', 'carbsG', 'fatG', 'kcal', 'proteinG']);
  });

  it.each([null, undefined, 'text', 42, [], {}, { items: 'x' }, { items: null }])('liefert nichts bei Nicht-Antwort %j', (raw) => {
    expect(sanitizeMealParse(raw)).toEqual({ items: [], droppedCount: 0 });
  });

  it('verwirft Zeilen ohne Namen, mit Namen ohne Text oder falschem Typ', () => {
    const result = sanitizeMealParse(response(wire({ name: '' }), wire({ name: '   ' }), wire({ name: 5 }), wire({ name: undefined })));
    expect(result.items).toEqual([]);
    expect(result.droppedCount).toBe(4);
  });

  it('bereinigt Namen: Steuerzeichen, Leerraum, Länge', () => {
    const [item] = sanitizeMealParse(response(wire({ name: `  Apfel\n\u0000  groß ${'x'.repeat(200)}` }))).items;
    expect(item.name.startsWith('Apfel groß x')).toBe(true);
    expect(item.name.length).toBeLessThanOrEqual(80);
    expect(item.name).not.toMatch(/[\u0000-\u001f]/);
  });

  it('prüft portionG zwischen 1 und 2000', () => {
    const result = sanitizeMealParse(response(
      wire({ name: 'a', portionG: 1 }), wire({ name: 'b', portionG: 2000 }),
      wire({ name: 'c', portionG: 0 }), wire({ name: 'd', portionG: 2001 }),
      wire({ name: 'e', portionG: -5 }), wire({ name: 'f', portionG: '100' }), wire({ name: 'g', portionG: NaN }),
      wire({ name: 'h', portionG: Infinity }),
    ));
    expect(result.items.map((i) => i.name)).toEqual(['a', 'b']);
    expect(result.droppedCount).toBe(6);
  });

  it('prüft kcal 0 bis 900 und Makros 0 bis 100 je 100 g', () => {
    const per = (o: Record<string, unknown>) => wire({ per100g: { kcal: 100, proteinG: 5, carbsG: 10, fatG: 3, ...o } });
    const ok = sanitizeMealParse(response(per({ kcal: 0, proteinG: 0, carbsG: 0, fatG: 0 }), per({ kcal: 900, proteinG: 0, carbsG: 0, fatG: 100 })));
    expect(ok.items).toHaveLength(2);
    const bad = sanitizeMealParse(response(
      per({ kcal: 901 }), per({ kcal: -1 }), per({ proteinG: 101 }), per({ carbsG: -0.1 }), per({ fatG: 101 }),
      per({ kcal: '100' }), per({ proteinG: null }), per({ carbsG: undefined }), per({ fatG: NaN }),
    ));
    expect(bad.items).toEqual([]);
    expect(bad.droppedCount).toBe(9);
  });

  it('verwirft fehlendes oder falsch getyptes per100g', () => {
    const result = sanitizeMealParse(response(wire({ per100g: undefined }), wire({ per100g: 'x' }), wire({ per100g: null }), wire({ per100g: [] })));
    expect(result.items).toEqual([]);
    expect(result.droppedCount).toBe(4);
  });

  it('verwirft Zeilen, deren Makros zusammen weit über 100 g je 100 g liegen (isPlausiblePer100g)', () => {
    const result = sanitizeMealParse(response(wire({ per100g: { kcal: 800, proteinG: 90, carbsG: 90, fatG: 90 } })));
    expect(result.items).toEqual([]);
  });

  it('verwirft Nicht-Objekte in der Liste', () => {
    const result = sanitizeMealParse(response(null, 'x', 5, [], wire()));
    expect(result.items).toHaveLength(1);
    expect(result.droppedCount).toBe(4);
  });

  it('nimmt höchstens 12 Zeilen', () => {
    const many = Array.from({ length: 20 }, (_, i) => wire({ name: `Zeile ${i}` }));
    const result = sanitizeMealParse(response(...many));
    expect(result.items).toHaveLength(MAX_MEAL_ITEMS);
    expect(result.items[11].name).toBe('Zeile 11');
  });

  it('fällt bei ungültiger Menge oder Einheit auf Gramm zurück (nur Anzeige)', () => {
    const [a, b] = sanitizeMealParse(response(wire({ amount: 'viel', unit: 7, portionG: 150 }), wire({ amount: -2, unit: '', portionG: 80 }))).items;
    expect(a).toMatchObject({ amount: 150, unit: 'g' });
    expect(b).toMatchObject({ amount: 80, unit: 'g' });
  });

  it('kürzt die Einheit', () => {
    const [item] = sanitizeMealParse(response(wire({ unit: 'Scheibe'.repeat(10) }))).items;
    expect(item.unit.length).toBeLessThanOrEqual(20);
  });

  describe('Atwater-Abgleich 4/4/9', () => {
    const doubt = (per100g: Record<string, number>) => sanitizeMealParse(response(wire({ per100g }))).items[0].isKcalDoubtful;

    it('markiert nicht bei passenden Werten', () => {
      expect(doubt({ kcal: 280, proteinG: 9, carbsG: 55, fatG: 1.5 })).toBe(false);
    });

    it('markiert bei mehr als 25 % Abweichung nach oben', () => {
      expect(doubt({ kcal: 400, proteinG: 9, carbsG: 55, fatG: 1.5 })).toBe(true);
    });

    it('markiert bei mehr als 25 % Abweichung nach unten', () => {
      expect(doubt({ kcal: 150, proteinG: 9, carbsG: 55, fatG: 1.5 })).toBe(true);
    });

    it('toleriert genau 25 % und korrigiert den Wert nie', () => {
      const expected = 4 * 10 + 4 * 20 + 9 * 10; // 210
      const limit = Math.floor(expected * 1.25);
      expect(doubt({ kcal: limit, proteinG: 10, carbsG: 20, fatG: 10 })).toBe(false);
      const [item] = sanitizeMealParse(response(wire({ per100g: { kcal: 500, proteinG: 10, carbsG: 20, fatG: 10 } }))).items;
      expect(item.isKcalDoubtful).toBe(true);
      expect(item.per100g.kcal).toBe(500);
    });

    it('markiert Wasser und Kaffee mit kleinen Restwerten nicht', () => {
      expect(doubt({ kcal: 0, proteinG: 0, carbsG: 0, fatG: 0 })).toBe(false);
      expect(doubt({ kcal: 2, proteinG: 0.1, carbsG: 0, fatG: 0 })).toBe(false);
    });

    it('markiert kcal ohne jede Makro-Angabe', () => {
      expect(doubt({ kcal: 300, proteinG: 0, carbsG: 0, fatG: 0 })).toBe(true);
    });
  });

  it('mutiert die Eingabe nicht', () => {
    const raw = response(wire());
    const snapshot = JSON.stringify(raw);
    sanitizeMealParse(raw);
    expect(JSON.stringify(raw)).toBe(snapshot);
  });
});
