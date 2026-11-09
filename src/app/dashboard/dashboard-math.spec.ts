import { describe, expect, it } from 'vitest';
import {
  isWarnMacro,
  macroEnergyShares,
  proteinHint,
  proteinOfEntries,
  softHyphenLabel,
  macroNote,
} from './dashboard-math';

describe('isWarnMacro', () => {
  it('warnt nur bei kcal, nie bei Eiweiß und nicht beim Zucker-Richtwert', () => {
    expect(isWarnMacro('kcal')).toBe(true);
    expect(isWarnMacro('sugar')).toBe(false);
    expect(isWarnMacro('protein')).toBe(false);
    expect(isWarnMacro('carbs')).toBe(false);
    expect(isWarnMacro('fat')).toBe(false);
    expect(isWarnMacro('fiber')).toBe(false);
  });
});

describe('macroNote', () => {
  it('erklärt beim Zucker den Unterschied zwischen Gesamtzucker und freiem Zucker', () => {
    const note = macroNote('sugar');
    expect(note).toContain('freien Zucker');
    expect(note).toContain('Gesamtzucker');
  });

  it('hat sonst keinen Hinweis', () => {
    expect(macroNote('protein')).toBeNull();
    expect(macroNote('kcal')).toBeNull();
  });
});

describe('macroEnergyShares', () => {
  it('verteilt die Energie aus Eiweiß, Kohlenhydraten und Fett in Prozent', () => {
    // 25 g E = 100 kcal, 50 g KH = 200 kcal, 22 g F = 198 kcal -> 498 kcal
    const s = macroEnergyShares({ proteinG: 25, carbsG: 50, fatG: 22 });
    expect(s).toEqual({ proteinPct: 20, carbsPct: 40, fatPct: 40 });
  });

  it('ergibt immer genau 100 Prozent', () => {
    const s = macroEnergyShares({ proteinG: 10, carbsG: 10, fatG: 10 })!;
    expect(s.proteinPct + s.carbsPct + s.fatPct).toBe(100);
  });

  it('liefert null ohne Energie aus Makros', () => {
    expect(macroEnergyShares({ proteinG: 0, carbsG: 0, fatG: 0 })).toBeNull();
    expect(macroEnergyShares({ proteinG: Number.NaN, carbsG: 0, fatG: 0 })).toBeNull();
  });
});

describe('proteinHint', () => {
  it('nennt das Restprotein, wenn es klein ist', () => {
    expect(proteinHint(25)).toBe('noch 25 g Eiweiß');
  });

  it('schweigt bei großem Rest oder erreichtem Ziel', () => {
    expect(proteinHint(80)).toBeNull();
    expect(proteinHint(0)).toBeNull();
  });
});

describe('proteinOfEntries', () => {
  it('summiert das Eiweiß der Einträge gerundet', () => {
    const entries = [{ facts: { proteinG: 10.4 } }, { facts: { proteinG: 5.3 } }, { facts: { proteinG: undefined } }];
    expect(proteinOfEntries(entries as never)).toBe(16);
  });
});

describe('softHyphenLabel', () => {
  it('trennt lange Nährwertnamen für schmale Kacheln', () => {
    expect(softHyphenLabel('Kohlenhydrate')).toContain('­');
    expect(softHyphenLabel('Fett')).toBe('Fett');
  });
});
