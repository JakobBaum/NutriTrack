import { describe, expect, it } from 'vitest';
import { PriceHint, priceHintText } from './price-hint';

describe('PriceHint', () => {
  it('uebernimmt nur das juengste Token', () => {
    const hint = new PriceHint();
    const first = hint.begin();
    const second = hint.begin();
    expect(hint.setIfCurrent(first, 'alt')).toBe(false);
    expect(hint.text()).toBeNull();
    expect(hint.setIfCurrent(second, 'neu')).toBe(true);
    expect(hint.text()).toBe('neu');
  });

  it('set verwirft laufende Anfragen', () => {
    const hint = new PriceHint();
    const token = hint.begin();
    hint.set(null);
    expect(hint.setIfCurrent(token, 'zu spaet')).toBe(false);
    expect(hint.text()).toBeNull();
  });
});

describe('priceHintText', () => {
  it('nennt Preis mit Komma und Waehrung', () => {
    expect(priceHintText({ avg: 2.5, currency: 'EUR', count: 3 })).toBe('Realer Preis ca. 2,50 EUR.');
  });
});
