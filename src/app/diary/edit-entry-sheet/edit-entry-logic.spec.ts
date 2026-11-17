import { describe, expect, it } from 'vitest';
import { DiaryEntry, NutritionFacts } from '../../core/models';
import {
  EMPTY_NAME_MESSAGE,
  MISSING_AMOUNT_MESSAGE,
  MISSING_SERVINGS_MESSAGE,
  buildEditPatch,
  initialEditState,
} from './edit-entry-logic';

const PER_100: NutritionFacts = { kcal: 100, proteinG: 10, carbsG: 20, fatG: 5, basis: 'per100g' };

function entry(over: Partial<DiaryEntry> = {}): DiaryEntry {
  return {
    id: 'e1', dateISO: '2026-11-14', meal: 'lunch', label: 'Reis', amountG: 200, unit: 'g', createdAt: '2026-11-14T10:00:00.000Z',
    ref: { kind: 'manual' },
    facts: { kcal: 200, proteinG: 20, carbsG: 40, fatG: 10, basis: 'perPortion' },
    baseFacts: PER_100,
    ...over,
  } as DiaryEntry;
}

describe('initialEditState', () => {
  it('zeigt die Menge in der Einheit des Eintrags', () => {
    const s = initialEditState(entry({ amountG: 500, unit: 'kg' as never }));
    expect(s.unit).toBe('kg');
    expect(s.amount).toBe(0.5);
    expect(s.mode).toBe('amount');
  });

  it('nimmt bei Portions-Einträgen die Portionen', () => {
    const s = initialEditState(entry({ amountG: undefined, baseFacts: undefined, servings: 2 }));
    expect(s.mode).toBe('portion');
    expect(s.servings).toBe(2);
  });
});

describe('buildEditPatch', () => {
  const base = (over = {}) => ({ ...initialEditState(entry()), ...over });

  it('verlangt einen Namen statt still nichts zu speichern (T10)', () => {
    expect(buildEditPatch(entry(), base({ label: '   ' }))).toEqual({ error: EMPTY_NAME_MESSAGE });
  });

  it('verlangt bei Mengen-Einträgen eine Menge', () => {
    expect(buildEditPatch(entry(), base({ amount: null }))).toEqual({ error: MISSING_AMOUNT_MESSAGE });
  });

  it('verlangt bei Portions-Einträgen Portionen und skaliert die Werte', () => {
    const portion = entry({ amountG: undefined, baseFacts: undefined, servings: 2 });
    const state = initialEditState(portion);
    expect(buildEditPatch(portion, { ...state, servings: 0 })).toEqual({ error: MISSING_SERVINGS_MESSAGE });
    const out = buildEditPatch(portion, { ...state, servings: 4 });
    expect(out.patch?.servings).toBe(4);
    expect(out.patch?.facts?.kcal).toBe(400);
  });

  it('übernimmt Menge und Einheit in Basiseinheit', () => {
    const out = buildEditPatch(entry(), base({ amount: 300 }));
    expect(out.patch).toMatchObject({ label: 'Reis', meal: 'lunch', amountG: 300, unit: 'g' });
  });

  it('setzt eine abgeleitete Basis nur bei geänderter Menge', () => {
    const manual = entry({ baseFacts: undefined });
    const state = initialEditState(manual);
    expect(buildEditPatch(manual, state).patch?.baseFacts).toBeUndefined();
    expect(buildEditPatch(manual, { ...state, amount: 300 }).patch?.baseFacts).toBeDefined();
  });

  it('entfernt bei optionaler Menge ein leeres Feld, lehnt 0 ab', () => {
    const optional = entry({ baseFacts: undefined, amountG: undefined, unit: undefined });
    const state = initialEditState(optional);
    expect(state.mode).toBe('optional');
    expect(buildEditPatch(optional, { ...state, amount: null }).patch?.clearAmount).toBe(true);
    expect(buildEditPatch(optional, { ...state, amount: 0 }).error).toContain('größer als 0');
  });
});
