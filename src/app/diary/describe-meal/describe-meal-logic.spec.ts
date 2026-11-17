import { describe, expect, it } from 'vitest';
import { ParsedMealItem } from '../../core/ai/meal-parse';
import {
  MealRow,
  canLogRows,
  checkDescription,
  entriesFromRows,
  labelFromDescription,
  mealTotals,
  removeRow,
  rowTotals,
  rowsFromItems,
  withAmountText,
  withSteppedAmount,
} from './describe-meal-logic';

const item = (over: Partial<ParsedMealItem> = {}): ParsedMealItem => ({
  name: 'Semmel', amount: 2, unit: 'Stk', portionG: 100, isKcalDoubtful: false,
  per100g: { kcal: 280, proteinG: 9, carbsG: 55, fatG: 1.5, basis: 'per100g' },
  ...over,
});

describe('checkDescription', () => {
  it('erkennt leeren Text (auch nur Leerzeichen)', () => {
    expect(checkDescription('')).toBe('empty');
    expect(checkDescription('   \n ')).toBe('empty');
  });
  it('erlaubt bis 500 Zeichen und sperrt darüber', () => {
    expect(checkDescription('a'.repeat(500))).toBe('ok');
    expect(checkDescription('a'.repeat(501))).toBe('tooLong');
  });
  it('zählt den Rand nicht mit', () => {
    expect(checkDescription(` ${'a'.repeat(500)} `)).toBe('ok');
  });
});

describe('rowsFromItems', () => {
  it('startet mit dem geschätzten Gewicht als Menge', () => {
    const [row] = rowsFromItems([item({ portionG: 120 })]);
    expect(row).toMatchObject({ name: 'Semmel', amountG: 120, amountText: '120', quantityLabel: '2 Stk', isKcalDoubtful: false });
  });
  it('vergibt eindeutige Ids und übernimmt das Zweifels-Kennzeichen', () => {
    const rows = rowsFromItems([item(), item({ isKcalDoubtful: true })]);
    expect(new Set(rows.map((r) => r.id)).size).toBe(2);
    expect(rows[1].isKcalDoubtful).toBe(true);
  });
  it('zeigt Gramm nicht doppelt als "100 g (100 g)"', () => {
    const [row] = rowsFromItems([item({ amount: 100, unit: 'g' })]);
    expect(row.quantityLabel).toBe('');
  });
});

describe('Menge ändern und Summen', () => {
  const rows = (): MealRow[] => rowsFromItems([item(), item({ name: 'Schinken', portionG: 40, per100g: { kcal: 110, proteinG: 20, carbsG: 1, fatG: 3, basis: 'per100g' } })]);

  it('rechnet kcal und Eiweiß der Zeile live aus der Menge', () => {
    const [semmel] = rows();
    expect(rowTotals(semmel)).toEqual({ kcal: 280, proteinG: 9 });
    const doubled = withAmountText(semmel, '200');
    expect(rowTotals(doubled)).toEqual({ kcal: 560, proteinG: 18 });
  });

  it('akzeptiert Dezimalkomma', () => {
    const [semmel] = rows();
    expect(withAmountText(semmel, '50,5').amountG).toBe(50.5);
  });

  it('zählt ungültige Mengen als 0 und sperrt das Eintragen', () => {
    const [semmel] = rows();
    for (const text of ['', 'abc', '0', '-5', '2001']) {
      const bad = withAmountText(semmel, text);
      expect(rowTotals(bad)).toEqual({ kcal: 0, proteinG: 0 });
      expect(canLogRows([bad])).toBe(false);
    }
  });

  it('summiert über alle Zeilen', () => {
    expect(mealTotals(rows())).toEqual({ kcal: 280 + 44, proteinG: 9 + 8 });
  });

  it('mutiert die Zeile nicht', () => {
    const [semmel] = rows();
    withAmountText(semmel, '5');
    expect(semmel.amountG).toBe(100);
  });

  it('Stepper ändert in 10er-Schritten, nie unter 10 und nie über 2000', () => {
    const [semmel] = rows();
    expect(withSteppedAmount(semmel, 1).amountG).toBe(110);
    expect(withSteppedAmount(withAmountText(semmel, '10'), -1).amountG).toBe(10);
    expect(withSteppedAmount(withAmountText(semmel, '2000'), 1).amountG).toBe(2000);
    expect(withSteppedAmount(withAmountText(semmel, ''), 1).amountG).toBe(10);
  });

  it('entfernt eine Zeile über die Id', () => {
    const all = rows();
    const rest = removeRow(all, all[0].id);
    expect(rest.map((r) => r.name)).toEqual(['Schinken']);
    expect(all).toHaveLength(2);
  });

  it('canLogRows ist bei leerer Liste falsch', () => {
    expect(canLogRows([])).toBe(false);
    expect(canLogRows(rows())).toBe(true);
  });
});

describe('entriesFromRows', () => {
  it('baut je Zeile einen Eintrag mit Menge, Faktor, Schätzkennzeichen und Bezugswerten', () => {
    const rows = [withAmountText(rowsFromItems([item()])[0], '150')];
    const [entry] = entriesFromRows(rows, '2026-11-14', 'breakfast');
    expect(entry).toMatchObject({
      dateISO: '2026-11-14', meal: 'breakfast', label: 'Semmel', amountG: 150, unit: 'g', isEstimate: true,
      facts: { kcal: 420, proteinG: 13.5, carbsG: 82.5, fatG: 2.3, basis: 'perPortion' },
      baseFacts: { kcal: 280, proteinG: 9, basis: 'per100g' },
    });
  });

  it('liefert für ungültige Zeilen keinen Eintrag', () => {
    const rows = [rowsFromItems([item()])[0], withAmountText(rowsFromItems([item({ name: 'B' })])[0], '')];
    expect(entriesFromRows(rows, '2026-11-14', 'lunch').map((e) => e.label)).toEqual(['Semmel']);
  });
});

describe('Dezimalkomma in der Mengenzeile (T15)', () => {
  it('zeigt die geschätzte Menge mit Komma', () => {
    expect(rowsFromItems([item({ portionG: 12.5 })])[0].amountText).toBe('12,5');
  });
  it('zeigt die Menge nach einem Schritt mit Komma', () => {
    const row = rowsFromItems([item({ portionG: 12.5 })])[0];
    expect(withSteppedAmount(row, 1).amountText).toBe('22,5');
  });
});

describe('labelFromDescription (T17)', () => {
  it('nimmt den getrimmten Text', () => {
    expect(labelFromDescription('  2 Semmeln mit Butter ')).toBe('2 Semmeln mit Butter');
  });
  it('kürzt lange Texte an einer Wortgrenze', () => {
    const label = labelFromDescription('Haferflocken mit Milch und Banane und Honig und Nüssen und Zimt und noch viel mehr Zutaten');
    expect(label.length).toBeLessThanOrEqual(60);
    expect(label.endsWith(' ')).toBe(false);
  });
});
