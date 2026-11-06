import { DiaryEntry, NutritionFacts } from '../core/models';
import {
  EMPTY_FIELDS,
  formatChipAmount,
  factsFromFields,
  fieldsFromFacts,
  isIsoDate,
  factsDiffer,
  isMealType,
  isValidAmount,
  rebaseTo100,
  unitForName,
  unitFactor,
  baseUnitOf,
  toBaseAmount,
  fromBaseAmount,
  formatAmount,
  mealForHour,
  mealLabel,
  scaleFacts,
  toNumberOrNull,
  quickAmounts,
  numberToInputText,
  inputTextFor,
  convertAmount,
  lastAmountForLabel,
  perServingFacts,
  editBaseFor,
} from './diary-helpers';

const OATS_PER_100G: NutritionFacts = {
  kcal: 372,
  proteinG: 13.5,
  carbsG: 58.7,
  fatG: 7,
  fiberG: 10,
  basis: 'per100g',
};

describe('mealForHour', () => {
  it('picks breakfast in the morning', () => {
    expect(mealForHour(7)).toBe('breakfast');
    expect(mealForHour(10)).toBe('breakfast');
  });

  it('picks lunch around midday', () => {
    expect(mealForHour(11)).toBe('lunch');
    expect(mealForHour(14)).toBe('lunch');
  });

  it('picks snack in the afternoon and dinner in the evening', () => {
    expect(mealForHour(16)).toBe('snack');
    expect(mealForHour(19)).toBe('dinner');
  });

  it('falls back to snack late at night', () => {
    expect(mealForHour(23)).toBe('snack');
    expect(mealForHour(2)).toBe('snack');
  });
});

describe('meal helpers', () => {
  it('validates meal types', () => {
    expect(isMealType('lunch')).toBe(true);
    expect(isMealType('brunch')).toBe(false);
    expect(isMealType(null)).toBe(false);
  });

  it('returns German labels', () => {
    expect(mealLabel('breakfast')).toBe('Frühstück');
  });

  it('validates ISO dates', () => {
    expect(isIsoDate('2026-11-05')).toBe(true);
    expect(isIsoDate('05.11.2026')).toBe(false);
    expect(isIsoDate(null)).toBe(false);
  });
});

describe('scaleFacts', () => {
  it('scales per-100g values to the entered amount and marks them perPortion', () => {
    const scaled = scaleFacts(OATS_PER_100G, 1.5);

    expect(scaled.kcal).toBe(558);
    expect(scaled.proteinG).toBe(20.3);
    expect(scaled.fiberG).toBe(15);
    expect(scaled.sugarG).toBeUndefined();
    expect(scaled.basis).toBe('perPortion');
  });

  it('does not mutate the base facts', () => {
    const copy = { ...OATS_PER_100G };

    scaleFacts(OATS_PER_100G, 2);

    expect(OATS_PER_100G).toEqual(copy);
  });
});

describe('fields <-> facts', () => {
  it('round-trips facts through form fields', () => {
    const facts = scaleFacts(OATS_PER_100G, 1);

    const back = factsFromFields(fieldsFromFacts(facts));

    expect(back?.kcal).toBe(372);
    expect(back?.proteinG).toBe(13.5);
    expect(back?.basis).toBe('perPortion');
  });

  it('returns null when calories are missing', () => {
    expect(factsFromFields(EMPTY_FIELDS)).toBeNull();
  });

  it('returns null for negative calories', () => {
    expect(factsFromFields({ ...EMPTY_FIELDS, kcal: -5 })).toBeNull();
  });

  it('treats empty macro fields as zero', () => {
    const facts = factsFromFields({ ...EMPTY_FIELDS, kcal: 120.4 });

    expect(facts).toMatchObject({ kcal: 120, proteinG: 0, carbsG: 0, fatG: 0 });
  });
});

describe('toNumberOrNull', () => {
  it('parses numbers, numeric strings and decimal commas', () => {
    expect(toNumberOrNull(150)).toBe(150);
    expect(toNumberOrNull('12.5')).toBe(12.5);
    expect(toNumberOrNull('12,5')).toBe(12.5);
  });

  it('returns null for empty or invalid input', () => {
    expect(toNumberOrNull('')).toBeNull();
    expect(toNumberOrNull(null)).toBeNull();
    expect(toNumberOrNull('abc')).toBeNull();
  });

  it('wertet Leerzeichen und Hex-Schreibweise nicht als Zahl', () => {
    expect(toNumberOrNull(' ')).toBeNull();
    expect(toNumberOrNull('0x1A')).toBeNull();
  });
});

describe('perServingFacts', () => {
  it('rechnet Gesamtwerte mehrerer Portionen auf eine Portion zurück', () => {
    const total: NutritionFacts = { kcal: 1000, proteinG: 40, carbsG: 100, fatG: 30, basis: 'perPortion' };
    expect(perServingFacts(total, 2)).toMatchObject({ kcal: 500, proteinG: 20, carbsG: 50, fatG: 15 });
  });

  it('lässt Werte bei 1 oder fehlenden/ungültigen Portionen unverändert', () => {
    const one: NutritionFacts = { kcal: 300, proteinG: 1, carbsG: 2, fatG: 3, basis: 'perPortion' };
    expect(perServingFacts(one, 1)).toBe(one);
    expect(perServingFacts(one, undefined)).toBe(one);
    expect(perServingFacts(one, 0)).toBe(one);
  });
});

describe('editBaseFor', () => {
  const base: DiaryEntry = {
    id: 'm1',
    dateISO: '2026-10-13',
    meal: 'breakfast',
    label: 'Orangensaft',
    ref: { kind: 'manual' },
    amountG: 500,
    unit: 'l',
    facts: { kcal: 225, proteinG: 3.5, carbsG: 50, fatG: 1, basis: 'perPortion' },
    createdAt: '2026-10-13T07:00:00.000Z',
  };

  it('leitet für manuelle Einträge mit Menge Werte pro 100 ab', () => {
    expect(editBaseFor(base)).toMatchObject({ kcal: 45, proteinG: 0.7, carbsG: 10, fatG: 0.2, basis: 'per100g' });
  });

  it('nutzt gespeicherte baseFacts und liefert ohne Menge null', () => {
    const stored: NutritionFacts = { kcal: 40, proteinG: 1, carbsG: 9, fatG: 0, basis: 'per100g' };
    expect(editBaseFor({ ...base, baseFacts: stored })).toBe(stored);
    expect(editBaseFor({ ...base, amountG: undefined })).toBeNull();
  });
});

describe('lastAmountForLabel', () => {
  const mk = (id: string, label: string, amountG: number | undefined, createdAt: string): DiaryEntry => ({
    id,
    dateISO: '2026-10-13',
    meal: 'breakfast',
    label,
    ref: { kind: 'manual' },
    amountG,
    facts: { kcal: 1, proteinG: 0, carbsG: 0, fatG: 0, basis: 'perPortion' },
    createdAt,
  });
  const entries = [
    mk('a', 'Haferflocken', 50, '2026-10-12T07:00:00.000Z'),
    mk('b', 'haferflocken ', 80, '2026-10-13T07:00:00.000Z'),
    mk('c', 'Haferflocken', undefined, '2026-10-13T08:00:00.000Z'),
  ];

  it('liefert die neueste Menge zum Namen (ohne Groß-/Kleinschreibung)', () => {
    expect(lastAmountForLabel(entries, 'Haferflocken')).toBe(80);
  });

  it('ignoriert den gerade bearbeiteten Eintrag', () => {
    expect(lastAmountForLabel(entries, 'Haferflocken', 'b')).toBe(50);
    expect(lastAmountForLabel([entries[1]], 'Haferflocken', 'b')).toBeNull();
  });

  it('liefert null für leeren Namen', () => {
    expect(lastAmountForLabel(entries, '  ')).toBeNull();
  });
});

describe('amount and unit helpers', () => {
  it('rejects empty, zero and negative amounts', () => {
    expect(isValidAmount(null)).toBe(false);
    expect(isValidAmount(0)).toBe(false);
    expect(isValidAmount(-5)).toBe(false);
    expect(isValidAmount(150)).toBe(true);
  });

  it('detects liquids by name', () => {
    expect(unitForName('Vollmilch 3,5%')).toBe('ml');
    expect(unitForName('Haferflocken')).toBe('g');
  });

  it('rebases adjusted facts to per 100 g', () => {
    const base = rebaseTo100(scaleFacts(OATS_PER_100G, 2), 200);
    expect(base.basis).toBe('per100g');
    expect(base.kcal).toBe(372);
  });

  it('detects differing facts', () => {
    const a = scaleFacts(OATS_PER_100G, 1);
    expect(factsDiffer(a, { ...a })).toBe(false);
    expect(factsDiffer(a, { ...a, kcal: a.kcal + 1 })).toBe(true);
  });
});

describe('Mengeneinheiten', () => {
  it('unitFactor: kg und l sind 1000, g und ml 1', () => {
    expect(unitFactor('kg')).toBe(1000);
    expect(unitFactor('l')).toBe(1000);
    expect(unitFactor('g')).toBe(1);
    expect(unitFactor('ml')).toBe(1);
  });

  it('baseUnitOf liefert g bzw. ml', () => {
    expect(baseUnitOf('kg')).toBe('g');
    expect(baseUnitOf('g')).toBe('g');
    expect(baseUnitOf('l')).toBe('ml');
    expect(baseUnitOf('ml')).toBe('ml');
  });

  it('toBaseAmount rechnet in Basiseinheit um', () => {
    expect(toBaseAmount(0.5, 'kg')).toBe(500);
    expect(toBaseAmount(1.2, 'l')).toBe(1200);
    expect(toBaseAmount(250, 'g')).toBe(250);
  });

  it('fromBaseAmount rundet auf höchstens 3 Nachkommastellen', () => {
    expect(fromBaseAmount(250, 'l')).toBe(0.25);
    expect(fromBaseAmount(1, 'kg')).toBe(0.001);
    expect(fromBaseAmount(1 / 3, 'g')).toBe(0.333);
    expect(fromBaseAmount(250, 'ml')).toBe(250);
  });

  it('convertAmount verliert beim Wechsel g -> kg -> g keine Kleinstmengen', () => {
    const kg = convertAmount(0.4, 'g', 'kg');
    expect(convertAmount(kg, 'kg', 'g')).toBeCloseTo(0.4, 9);
    expect(toBaseAmount(convertAmount(kg, 'kg', 'g'), 'g')).toBe(0.4);
    expect(convertAmount(0.25, 'l', 'ml')).toBe(250);
  });

  it('numberToInputText rundet nur die Anzeige', () => {
    expect(numberToInputText(0.0004)).toBe('0,0004');
    expect(numberToInputText(0.12340000000000001)).toBe('0,1234');
  });

  it('formatAmount nutzt Dezimalkomma und Einheit', () => {
    expect(formatAmount(250, 'g')).toBe('250 g');
    expect(formatAmount(500, 'l')).toBe('0,5 l');
    expect(formatAmount(1200, 'kg')).toBe('1,2 kg');
    expect(formatAmount(250)).toBe('250 g');
  });
});

describe('quickAmounts', () => {
  it('returns 50-200 for g and ml', () => {
    expect(quickAmounts('g')).toEqual([50, 100, 150, 200]);
    expect(quickAmounts('ml')).toEqual([50, 100, 150, 200]);
  });
  it('returns 0.1-1 for kg and l', () => {
    expect(quickAmounts('kg')).toEqual([0.1, 0.25, 0.5, 1]);
    expect(quickAmounts('l')).toEqual([0.1, 0.25, 0.5, 1]);
  });
});

describe('number input text', () => {
  it('formats with decimal comma', () => {
    expect(numberToInputText(1.5)).toBe('1,5');
    expect(numberToInputText(null)).toBe('');
  });
  it('keeps raw typing text while it matches the value', () => {
    expect(inputTextFor('1,', 1)).toBe('1,');
    expect(inputTextFor('1,5', 1.5)).toBe('1,5');
  });
  it('falls back to formatted value when raw is stale', () => {
    expect(inputTextFor('1,5', 2)).toBe('2');
    expect(inputTextFor(undefined, 0.25)).toBe('0,25');
  });
});

describe('formatChipAmount', () => {
  it('shows g and ml without decimals', () => {
    expect(formatChipAmount(150, 'g')).toBe('150');
    expect(formatChipAmount(200, 'ml')).toBe('200');
  });

  it('shows kg and l with up to two decimals', () => {
    expect(formatChipAmount(0.25, 'kg')).toBe('0,25');
    expect(formatChipAmount(1, 'l')).toBe('1');
    expect(formatChipAmount(0.1, 'kg')).toBe('0,1');
  });
});

describe('salt in fields', () => {
  it('carries salt through facts, fields and scaling', () => {
    const facts = factsFromFields({ ...EMPTY_FIELDS, kcal: 100, saltG: 1.5 });
    expect(facts?.saltG).toBe(1.5);
    expect(fieldsFromFacts(facts!).saltG).toBe(1.5);
    expect(scaleFacts({ ...facts!, basis: 'per100g' }, 0.5).saltG).toBe(0.75);
  });
});
