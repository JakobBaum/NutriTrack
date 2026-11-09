import { describe, expect, it } from 'vitest';
import { entryAddedMessage } from './entry-message';

describe('entryAddedMessage', () => {
  it('nennt Essenszeit, kcal und Eiweiß', () => {
    expect(entryAddedMessage('breakfast', { kcal: 250.4, proteinG: 18.2 })).toBe('In Frühstück eingetragen · 250 kcal · 18 g Eiweiß');
  });

  it('rundet auf ganze Zahlen', () => {
    expect(entryAddedMessage('dinner', { kcal: 234.6, proteinG: 0 })).toBe('In Abendessen eingetragen · 235 kcal · 0 g Eiweiß');
  });
});
