import { describe, expect, it } from 'vitest';
import {
  entryCountLabel,
  isMealDraftChanged,
  manualBlockReason,
  mealSaveBlockReason,
  rescaleDraftEntry,
  rescaleEntryAmount,
} from './meal-draft';

describe('mealSaveBlockReason', () => {
  it('nennt den fehlenden Namen zuerst', () => {
    expect(mealSaveBlockReason('  ', 0)).toMatch(/Namen/);
  });
  it('nennt fehlende Einträge, wenn der Name da ist', () => {
    expect(mealSaveBlockReason('Frühstück', 0)).toMatch(/mindestens ein/i);
  });
  it('ist leer, wenn alles passt', () => {
    expect(mealSaveBlockReason('Frühstück', 1)).toBe('');
  });
});

describe('isMealDraftChanged / rescaleEntryAmount', () => {
  const entry = { label: 'Hafer', amountG: 50, facts: { kcal: 200, proteinG: 7 } };
  it('erkennt Änderungen gegenüber dem Ausgangszustand', () => {
    const baseline = { name: 'Brei', entries: [entry] };
    expect(isMealDraftChanged(baseline, 'Brei ', [entry])).toBe(false);
    expect(isMealDraftChanged(baseline, 'Brei', [])).toBe(true);
    expect(isMealDraftChanged(baseline, 'Haferbrei', [entry])).toBe(true);
  });
  it('skaliert Nährwerte proportional zur neuen Menge', () => {
    const scaled = rescaleEntryAmount(entry, 100);
    expect(scaled.amountG).toBe(100);
    expect(scaled.facts.kcal).toBe(400);
    expect(rescaleEntryAmount(entry, 0)).toBe(entry);
  });
});

describe('rescaleDraftEntry (immer vom Ursprungseintrag)', () => {
  const origin = { label: 'Reis', amountG: 150, facts: { kcal: 195, proteinG: 4.1, carbsG: 42.3, fatG: 0.5 } };

  it('ergibt beim Tippen "1", "12", "120" dasselbe wie direkt "120"', () => {
    let entries = [origin];
    for (const typed of [1, 12, 120]) entries = rescaleDraftEntry(entries, [origin], 0, typed);

    expect(entries[0]).toEqual(rescaleEntryAmount(origin, 120));
  });

  it('stellt nach Zwischenwert 0 die Ursprungswerte exakt wieder her', () => {
    let entries = rescaleDraftEntry([origin], [origin], 0, 10);
    entries = rescaleDraftEntry(entries, [origin], 0, 0);
    entries = rescaleDraftEntry(entries, [origin], 0, 150);

    expect(entries[0]).toEqual(origin);
  });

  it('lässt den Eintrag bei ungültiger Menge unverändert und verändert die Eingaben nicht', () => {
    const out = rescaleDraftEntry([origin], [origin], 0, Number.NaN);

    expect(out[0]).toBe(origin);
    expect(origin.amountG).toBe(150);
    expect(origin.facts.kcal).toBe(195);
  });

  it('ändert nur den gewählten Eintrag', () => {
    const other = { label: 'Ei', amountG: 60, facts: { kcal: 90 } };
    const out = rescaleDraftEntry([origin, other], [origin, other], 0, 300);

    expect(out[1]).toBe(other);
    expect(out[0].facts.kcal).toBe(390);
  });
});

describe('entryCountLabel', () => {
  it('trennt Einzahl und Mehrzahl', () => {
    expect(entryCountLabel(1)).toBe('1 Eintrag');
    expect(entryCountLabel(0)).toBe('0 Einträge');
    expect(entryCountLabel(3)).toBe('3 Einträge');
  });
});

describe('manualBlockReason', () => {
  it('nennt zuerst den fehlenden Namen', () => {
    expect(manualBlockReason(' ', '100')).toMatch(/Namen/);
  });
  it('nennt fehlende oder ungültige Kalorien', () => {
    expect(manualBlockReason('Hafer', '')).toMatch(/Kalorien/);
    expect(manualBlockReason('Hafer', '0')).toMatch(/Kalorien/);
    expect(manualBlockReason('Hafer', 'abc')).toMatch(/Kalorien/);
  });
  it('ist leer, wenn Name und Kalorien passen', () => {
    expect(manualBlockReason('Hafer', '12,5')).toBe('');
  });
});
