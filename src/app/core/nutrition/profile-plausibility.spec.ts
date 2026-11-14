import { describe, expect, it } from 'vitest';
import { bmiOf, profileNotes } from './profile-plausibility';

const adult = { weightKg: 75, heightCm: 175, age: 30, goal: 'maintain' as const };

describe('bmiOf', () => {
  it('berechnet den BMI aus Gewicht und Größe', () => {
    expect(bmiOf(80, 180)).toBeCloseTo(24.69, 2);
  });

  it('liefert null bei ungültigen Werten', () => {
    expect(bmiOf(0, 180)).toBeNull();
    expect(bmiOf(80, 0)).toBeNull();
    expect(bmiOf(Number.NaN, 180)).toBeNull();
  });
});

describe('profileNotes', () => {
  it('liefert bei einem unauffälligen Erwachsenen keine Hinweise', () => {
    expect(profileNotes(adult)).toEqual([]);
  });

  it('weist bei unter 18 Jahren auf Erwachsenenformeln hin', () => {
    const notes = profileNotes({ ...adult, age: 16 });
    expect(notes.map((n) => n.code)).toEqual(['minor']);
    expect(notes[0].text).toContain('Erwachsene');
  });

  it('rät Minderjährigen mit Ziel Abnehmen deutlich ab und nennt nur diesen einen Hinweis', () => {
    const notes = profileNotes({ ...adult, age: 16, goal: 'lose' });
    expect(notes.map((n) => n.code)).toEqual(['minorLose']);
    expect(notes[0].text).toContain('Abnehmen');
  });

  it('weist bei BMI über 30 auf das Referenzgewicht für Eiweiß hin', () => {
    const notes = profileNotes({ ...adult, weightKg: 110 });
    expect(notes.map((n) => n.code)).toEqual(['referenceWeight']);
  });

  it('rät bei Untergewicht vom Abnehmen ab, nicht vom Halten', () => {
    const light = { ...adult, weightKg: 52 }; // BMI 17,0
    expect(profileNotes(light)).toEqual([]);
    expect(profileNotes({ ...light, goal: 'lose' }).map((n) => n.code)).toEqual(['underweightLose']);
  });

  it('bittet bei unplausiblem BMI um Prüfung der Eingaben und nennt sonst nichts', () => {
    expect(profileNotes({ ...adult, weightKg: 40, heightCm: 190 }).map((n) => n.code)).toEqual(['implausible']);
    expect(profileNotes({ ...adult, weightKg: 300, heightCm: 130 }).map((n) => n.code)).toEqual(['implausible']);
  });

  it('kombiniert Altershinweis mit BMI-Hinweis', () => {
    const codes = profileNotes({ ...adult, age: 15, weightKg: 110 }).map((n) => n.code);
    expect(codes).toEqual(['minor', 'referenceWeight']);
  });

  it('ignoriert fehlende Werte', () => {
    expect(profileNotes({ weightKg: 0, heightCm: 0, age: 0, goal: 'lose' })).toEqual([]);
  });
});
