import { describe, expect, it } from 'vitest';
import { parseNutritionLabel } from './nutrition-label-parser';

const DE_SIMPLE = `Nährwerte pro 100 g
Brennwert 1590 kJ / 380 kcal
Fett 12 g
davon gesättigte Fettsäuren 3,2 g
Kohlenhydrate 55 g
davon Zucker 21 g
Ballaststoffe 6,5 g
Eiweiß 9,1 g
Salz 0,45 g`;

const DE_TWO_COLUMN = `Durchschnittliche Nährwerte   pro 100 g   pro Portion (30 g)
Energie   1850 kJ / 442 kcal   555 kJ / 133 kcal
Fett   21 g   6,3 g
davon gesättigte Fettsäuren   9,5 g   2,9 g
Kohlenhydrate   52 g   15,6 g
davon Zucker   28 g   8,4 g
Ballaststoffe   3,1 g   0,9 g
Eiweiß   6,8 g   2,0 g
Salz   0,30 g   0,09 g`;

const PORTION_FIRST = `Nutrition per serving (25 g) | per 100 g
Energy 480 kJ / 114 kcal | 1920 kJ / 456 kcal
Fat 4.5 g | 18 g
of which saturates 0.8 g | 3.2 g
Carbohydrate 14 g | 56 g
of which sugars 3.0 g | 12 g
Fibre 2.5 g | 10 g
Protein 5.0 g | 20 g
Salt 0.25 g | 1.0 g`;

const EN_LABEL = `Nutrition Facts per 100 g
Energy 2100 kJ / 502 kcal
Fat 31 g
of which saturates 12 g
Carbohydrates 49 g
of which sugars 47 g
Fibre 2.1 g
Protein 6.3 g
Salt 0.24 g`;

describe('parseNutritionLabel', () => {
  it('reads a simple German table per 100 g', () => {
    const r = parseNutritionLabel(DE_SIMPLE);
    expect(r.basis).toBe('per100g');
    expect(r.values).toMatchObject({
      kcal: 380, fatG: 12, saturatedFatG: 3.2, carbsG: 55, sugarG: 21, fiberG: 6.5, proteinG: 9.1, saltG: 0.45,
    });
    expect(r.found).toHaveLength(8);
    expect(r.confidence).toBeGreaterThan(0.9);
  });

  it('takes the 100 g column of a two-column table (100 g first)', () => {
    const r = parseNutritionLabel(DE_TWO_COLUMN);
    expect(r.values.kcal).toBe(442);
    expect(r.values.fatG).toBe(21);
    expect(r.values.carbsG).toBe(52);
    expect(r.values.proteinG).toBe(6.8);
    expect(r.values.saltG).toBeCloseTo(0.3);
  });

  it('takes the 100 g column when the portion column comes first', () => {
    const r = parseNutritionLabel(PORTION_FIRST);
    expect(r.values.kcal).toBe(456);
    expect(r.values.fatG).toBe(18);
    expect(r.values.carbsG).toBe(56);
    expect(r.values.fiberG).toBe(10);
    expect(r.values.proteinG).toBe(20);
  });

  it('parses an English label with decimal points', () => {
    const r = parseNutritionLabel(EN_LABEL);
    expect(r.values).toMatchObject({ kcal: 502, fatG: 31, carbsG: 49, sugarG: 47, fiberG: 2.1, proteinG: 6.3, saltG: 0.24 });
  });

  it('derives kcal from kJ when kcal is missing', () => {
    const r = parseNutritionLabel('pro 100 g\nEnergie 1046 kJ\nFett 2 g\nKohlenhydrate 50 g\nEiweiß 10 g');
    expect(r.values.kcal).toBeCloseTo(250, 0);
  });

  it('prefers kcal over kJ conversion', () => {
    const r = parseNutritionLabel('pro 100 g\nEnergie 1000 kJ / 230 kcal\nFett 2 g\nKohlenhydrate 50 g\nEiweiß 10 g');
    expect(r.values.kcal).toBe(230);
  });

  it('reads kJ and kcal on separate lines', () => {
    const r = parseNutritionLabel('pro 100 g\nEnergie 1590 kJ\n380 kcal\nFett 12 g\nKohlenhydrate 55 g\nEiweiß 9 g');
    expect(r.values.kcal).toBe(380);
  });

  it('handles "<" values as half of the limit', () => {
    const r = parseNutritionLabel('pro 100 g\nBrennwert 120 kcal\nFett < 0,5 g\nKohlenhydrate 20 g\nEiweiß 4 g\nSalz <0,1 g');
    expect(r.values.fatG).toBeCloseTo(0.25);
    expect(r.values.saltG).toBeCloseTo(0.05);
  });

  it('repairs O/0 and l/1 OCR confusions inside numbers', () => {
    const r = parseNutritionLabel('pro 100 g\nBrennwert 38O kcal\nFett 1O,5 g\nKohlenhydrate 5l g\nEiweiß 9,l g');
    expect(r.values.kcal).toBe(380);
    expect(r.values.fatG).toBe(10.5);
    expect(r.values.carbsG).toBe(51);
    expect(r.values.proteinG).toBe(9.1);
  });

  it('tolerates a misspelled unit (kca1) and noisy Eiweiss spellings', () => {
    const r = parseNutritionLabel('pro 100 g\nEnergie 1100 kJ / 263 kca1\nFett 5 g\nKohlenhydrate 40 g\nEiweiss 8 g');
    expect(r.values.kcal).toBe(263);
    expect(r.values.proteinG).toBe(8);
  });

  it('ignores percent reference intakes', () => {
    const r = parseNutritionLabel('pro 100 g / %RI\nEnergie 380 kcal 19%\nFett 12 g 17%\nKohlenhydrate 55 g 21%\nEiweiß 9 g 18%\nSalz 0,5 g 8%');
    expect(r.values.fatG).toBe(12);
    expect(r.values.saltG).toBe(0.5);
  });

  it('ignores unsaturated sub-lines', () => {
    const r = parseNutritionLabel('pro 100 g\nFett 20 g\ndavon einfach ungesättigte Fettsäuren 9 g\ndavon mehrfach ungesättigte Fettsäuren 4 g\ndavon gesättigte Fettsäuren 6 g');
    expect(r.values.fatG).toBe(20);
    expect(r.values.saturatedFatG).toBe(6);
  });

  it('converts sodium to salt', () => {
    const r = parseNutritionLabel('per 100 g\nEnergy 100 kcal\nSodium 0.4 g');
    expect(r.values.saltG).toBeCloseTo(1);
  });

  it('detects per 100 ml', () => {
    const r = parseNutritionLabel('Nährwerte je 100 ml\nBrennwert 190 kJ / 45 kcal\nFett 0 g\nKohlenhydrate 11 g\ndavon Zucker 11 g\nEiweiß 0 g');
    expect(r.basis).toBe('per100ml');
    expect(r.values.kcal).toBe(45);
    expect(r.values.sugarG).toBe(11);
  });

  it('reports per-portion basis when no 100 g column exists', () => {
    const r = parseNutritionLabel('Nährwerte pro Portion\nEnergie 150 kcal\nFett 5 g\nKohlenhydrate 20 g\nEiweiß 4 g');
    expect(r.basis).toBe('perPortion');
    expect(r.values.kcal).toBe(150);
  });

  it('reads values that wrap onto the next line', () => {
    const r = parseNutritionLabel('pro 100 g\nEnergie\n1590 kJ / 380 kcal\nFett\n12 g\nKohlenhydrate 55 g\nEiweiß 9 g');
    expect(r.values.kcal).toBe(380);
    expect(r.values.fatG).toBe(12);
  });

  it('handles thousands separators in kJ', () => {
    const r = parseNutritionLabel('pro 100 g\nEnergie 1.590 kJ\nFett 12 g\nKohlenhydrate 55 g\nEiweiß 9 g');
    expect(r.values.kcal).toBeCloseTo(380, 0);
  });

  it('survives messy spacing, tabs and mixed case', () => {
    const r = parseNutritionLabel('NÄHRWERTE   PRO 100G\n  BRENNWERT\t 1 5 9 0 kJ / 380 KCAL \n  FETT\t12,0G\n  KOHLENHYDRATE 55,0 G\n  EIWEIß   9,0 g');
    expect(r.values.kcal).toBe(380);
    expect(r.values.fatG).toBe(12);
    expect(r.values.carbsG).toBe(55);
  });

  it('does not treat ingredient lists as nutrition values', () => {
    const r = parseNutritionLabel('Zutaten: Weizenmehl, Zucker (12%), Palmfett, Salz, Eiweiß');
    expect(r.found).toHaveLength(0);
    expect(r.confidence).toBe(0);
  });

  it('drops implausible values (kcal above 950 per 100 g)', () => {
    const r = parseNutritionLabel('pro 100 g\nEnergie 3800 kcal\nFett 12 g');
    expect(r.values.kcal).toBeUndefined();
  });

  it('drops sugar that exceeds carbohydrates', () => {
    const r = parseNutritionLabel('pro 100 g\nKohlenhydrate 10 g\ndavon Zucker 40 g');
    expect(r.values.sugarG).toBeUndefined();
    expect(r.values.carbsG).toBe(10);
  });

  it('lowers confidence for inconsistent macros', () => {
    const consistent = parseNutritionLabel('pro 100 g\nEnergie 380 kcal\nFett 12 g\nKohlenhydrate 55 g\nEiweiß 9 g');
    const off = parseNutritionLabel('pro 100 g\nEnergie 80 kcal\nFett 12 g\nKohlenhydrate 55 g\nEiweiß 9 g');
    expect(off.confidence).toBeLessThan(consistent.confidence);
  });

  it('lowers confidence when the basis is only assumed', () => {
    const stated = parseNutritionLabel('pro 100 g\nEnergie 380 kcal\nFett 12 g\nKohlenhydrate 55 g\nEiweiß 9 g');
    const assumed = parseNutritionLabel('Energie 380 kcal\nFett 12 g\nKohlenhydrate 55 g\nEiweiß 9 g');
    expect(assumed.basis).toBe('per100g');
    expect(assumed.confidence).toBeLessThan(stated.confidence);
  });

  it('returns an empty result for empty input', () => {
    const r = parseNutritionLabel('');
    expect(r.found).toEqual([]);
    expect(r.confidence).toBe(0);
  });

  it('lists found fields in a stable order', () => {
    const r = parseNutritionLabel(DE_SIMPLE);
    expect(r.found.slice(0, 3)).toEqual(['kcal', 'fatG', 'saturatedFatG']);
  });
});
