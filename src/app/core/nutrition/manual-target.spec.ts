import { describe, expect, it } from 'vitest';
import {
  MANUAL_KCAL_RANGE,
  MANUAL_PROTEIN_RANGE,
  manualKcalError,
  manualKcalOf,
  manualKcalWarning,
  manualProteinError,
  manualProteinPerKgOf,
} from './manual-target';

describe('manualKcalOf / manualProteinPerKgOf', () => {
  it('liefert gültige Werte unverändert', () => {
    expect(manualKcalOf({ manualKcal: 2200 })).toBe(2200);
    expect(manualProteinPerKgOf({ manualProteinGPerKg: 2.1 })).toBe(2.1);
  });

  it('ignoriert fehlende, ungültige und außerhalb der Grenzen liegende Werte', () => {
    expect(manualKcalOf({})).toBeNull();
    expect(manualKcalOf({ manualKcal: Number.NaN })).toBeNull();
    expect(manualKcalOf({ manualKcal: MANUAL_KCAL_RANGE.min - 1 })).toBeNull();
    expect(manualKcalOf({ manualKcal: MANUAL_KCAL_RANGE.max + 1 })).toBeNull();
    expect(manualProteinPerKgOf({})).toBeNull();
    expect(manualProteinPerKgOf({ manualProteinGPerKg: 0.5 })).toBeNull();
    expect(manualProteinPerKgOf({ manualProteinGPerKg: 3 })).toBeNull();
  });
});

describe('manualKcalError', () => {
  it('akzeptiert Werte im Bereich', () => {
    expect(manualKcalError('2200')).toBeNull();
    expect(manualKcalError(String(MANUAL_KCAL_RANGE.min))).toBeNull();
    expect(manualKcalError(String(MANUAL_KCAL_RANGE.max))).toBeNull();
  });

  it('meldet leer, keine Zahl und Werte außerhalb des Bereichs mit eigenem Text', () => {
    expect(manualKcalError('')).toContain('Wert');
    expect(manualKcalError('abc')).toContain('Zahl');
    expect(manualKcalError('999')).toContain('1.000');
    expect(manualKcalError('6001')).toContain('6.000');
  });
});

describe('manualProteinError', () => {
  it('akzeptiert 1,2 bis 2,4 g/kg mit Komma und Punkt', () => {
    expect(manualProteinError('1,2')).toBeNull();
    expect(manualProteinError('2.4')).toBeNull();
    expect(manualProteinError('2,0')).toBeNull();
  });

  it('meldet Werte außerhalb mit dem erlaubten Bereich statt zu begrenzen', () => {
    expect(manualProteinError('1,1')).toContain('1,2');
    expect(manualProteinError('2,5')).toContain('2,4');
    expect(manualProteinError('')).toContain('Wert');
    expect(manualProteinError('x')).toContain('Zahl');
    expect(MANUAL_PROTEIN_RANGE.max).toBe(2.4);
  });
});

describe('manualKcalWarning', () => {
  const MIN = 1500;

  it('warnt, wenn das Ziel unter der Mindestzufuhr liegt, und nennt den Wert', () => {
    const warning = manualKcalWarning(1200, MIN);
    expect(warning).toContain('1.500');
    expect(warning).toContain('Hinweis');
  });

  it('warnt nicht bei Mindestzufuhr oder mehr', () => {
    expect(manualKcalWarning(1500, MIN)).toBeNull();
    expect(manualKcalWarning(2200, MIN)).toBeNull();
  });

  it('warnt nicht bei fehlendem oder unzulässigem Wert (dort steht der Fehler)', () => {
    expect(manualKcalWarning(null, MIN)).toBeNull();
    expect(manualKcalWarning(MANUAL_KCAL_RANGE.min - 1, MIN)).toBeNull();
  });
});
