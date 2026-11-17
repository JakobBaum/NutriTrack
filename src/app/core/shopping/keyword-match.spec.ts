import { describe, expect, it } from 'vitest';
import { foldAccents, matchesKeyword, wordsOf } from './keyword-match';

describe('wordsOf', () => {
  it('behält Akzentbuchstaben im Wort', () => {
    expect(wordsOf('crème fraîche')).toEqual(['crème', 'fraîche']);
    expect(wordsOf('jalapeño-chili, café')).toEqual(['jalapeño', 'chili', 'café']);
  });

  it('trennt weiter an Ziffern und Satzzeichen', () => {
    expect(wordsOf('milch 3,5%')).toEqual(['milch']);
  });
});

describe('foldAccents', () => {
  it('entfernt Akzente, lässt Umlaute und ß stehen', () => {
    expect(foldAccents('crème fraîche café jalapeño')).toBe('creme fraiche cafe jalapeno');
    expect(foldAccents('hähnchen größe über')).toBe('hähnchen größe über');
  });
});

describe('matchesKeyword', () => {
  it('trifft Crème fraîche mit dem Stichwort crème und akzent-unempfindlich', () => {
    expect(matchesKeyword('crème fraîche', 'crème', 'edge')).toBe(true);
    expect(matchesKeyword('creme fraiche', 'crème', 'edge')).toBe(true);
    expect(matchesKeyword('crème fraîche', 'creme', 'edge')).toBe(true);
  });

  it('trifft Café und Jalapeño', () => {
    expect(matchesKeyword('café latte', 'cafe', 'edge')).toBe(true);
    expect(matchesKeyword('jalapeño', 'jalapeno')).toBe(true);
  });

  it('bleibt an Wortgrenzen (Preiselbeeren trifft nicht reis, Hähnchenbrust trifft hähnchen)', () => {
    expect(matchesKeyword('preiselbeeren', 'reis')).toBe(false);
    expect(matchesKeyword('hähnchenbrust', 'hähnchen', 'edge')).toBe(true);
  });

  it('behandelt Sonderzeichen im Stichwort wörtlich (kein Regex, kein Fehler)', () => {
    expect(matchesKeyword('axb', 'a.b')).toBe(false);
    expect(matchesKeyword('axb', 'a.b', 'edge')).toBe(false);
    expect(() => matchesKeyword('abc', 'a(b')).not.toThrow();
    expect(() => matchesKeyword('abc', '[ab', 'edge')).not.toThrow();
    expect(matchesKeyword('abc', 'a(b')).toBe(false);
  });

  it('liefert bei wiederholtem Aufruf (zwischengespeicherte Regex) dasselbe Ergebnis', () => {
    expect(matchesKeyword('vollkornreis', 'reis')).toBe(true);
    expect(matchesKeyword('vollkornreis', 'reis')).toBe(true);
    expect(matchesKeyword('preiselbeeren', 'reis')).toBe(false);
  });

  it('unterscheidet Umlaute weiterhin von ihrem Grundbuchstaben', () => {
    expect(matchesKeyword('mus', 'müs', 'edge')).toBe(false);
    expect(matchesKeyword('müsli', 'musli', 'edge')).toBe(false);
  });
});
