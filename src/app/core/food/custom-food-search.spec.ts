import { describe, expect, it } from 'vitest';
import { CustomFood } from '../state/custom-food.store';
import { CUSTOM_SOURCE, customToFoodItem, isCustomFoodItem, matchCustomFoods, recentCustomFoods } from './custom-food-search';

const FACTS = { kcal: 100, proteinG: 5, carbsG: 10, fatG: 2, basis: 'perPortion' as const };
const food = (id: string, name: string): CustomFood => ({ id, name, facts: FACTS, createdAt: '2026-01-01T00:00:00.000Z' });

describe('customToFoodItem', () => {
  it('markiert den Treffer als eigen und behält die Werte', () => {
    const item = customToFoodItem(food('a', 'Haferbrei'));
    expect(item).toEqual({ id: 'custom:a', source: CUSTOM_SOURCE, name: 'Haferbrei', facts: FACTS });
    expect(isCustomFoodItem(item)).toBe(true);
    expect(isCustomFoodItem({ ...item, source: 'openfoodfacts' })).toBe(false);
  });
});

describe('matchCustomFoods', () => {
  const foods = [food('1', 'Griechischer Joghurt'), food('2', 'Joghurt Natur'), food('3', 'Müsli mit Joghurt'), food('4', 'Reis')];

  it('liefert ohne Suchbegriff nichts', () => {
    expect(matchCustomFoods(foods, '   ')).toEqual([]);
  });

  it('sortiert Namensanfang vor Wortanfang vor Enthalten', () => {
    const names = matchCustomFoods(foods, 'jog').map((i) => i.name);
    expect(names).toEqual(['Joghurt Natur', 'Griechischer Joghurt', 'Müsli mit Joghurt']);
  });

  it('ignoriert Groß-/Kleinschreibung und Akzente', () => {
    expect(matchCustomFoods(foods, 'MUSLI').map((i) => i.name)).toEqual(['Müsli mit Joghurt']);
  });

  it('findet mehrere Wörter in beliebiger Reihenfolge', () => {
    expect(matchCustomFoods(foods, 'natur joghurt').map((i) => i.name)).toEqual(['Joghurt Natur']);
  });

  it('begrenzt die Trefferzahl und ändert die Eingabe nicht', () => {
    const copy = [...foods];
    expect(matchCustomFoods(foods, 'joghurt', 2)).toHaveLength(2);
    expect(foods).toEqual(copy);
  });

  it('findet nach Monaten noch alte Einträge (kein Ablauf)', () => {
    const old = { ...food('9', 'Altes Rezept-Pesto'), createdAt: '2020-01-01T00:00:00.000Z' };
    expect(matchCustomFoods([old], 'pesto')).toHaveLength(1);
  });
});

describe('recentCustomFoods', () => {
  it('liefert die neuesten zuerst, begrenzt auf das Limit', () => {
    const foods = ['a', 'b', 'c', 'd', 'e', 'f', 'g'].map((n) => food(n, `Name ${n}`));
    expect(recentCustomFoods(foods).map((i) => i.id)).toEqual(['custom:a', 'custom:b', 'custom:c', 'custom:d', 'custom:e']);
    expect(recentCustomFoods(foods, 2)).toHaveLength(2);
  });
});
