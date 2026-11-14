import { describe, expect, it } from 'vitest';
import { DATA_SOURCES, LIBRARIES } from './sources-data';

describe('Quellen und Lizenzen', () => {
  it('nennt Open Food Facts mit ODbL und Fotolizenz', () => {
    const off = DATA_SOURCES.find((s) => s.name === 'Open Food Facts');
    expect(off?.license).toContain('ODbL');
    expect(off?.license).toContain('CC BY-SA');
  });

  it('enthält Open Prices, spoonacular und Google Gemini', () => {
    expect(DATA_SOURCES.map((s) => s.name)).toEqual(['Open Food Facts', 'Open Prices', 'spoonacular', 'Google Gemini']);
  });

  it('verlinkt jede Datenquelle über https', () => {
    expect(DATA_SOURCES.every((s) => s.url.startsWith('https://'))).toBe(true);
  });

  it('gibt jeder Bibliothek eine Lizenz und mindestens ein Paket', () => {
    expect(LIBRARIES.every((l) => l.license.length > 0 && l.packages.length > 0)).toBe(true);
  });

  it('listet Angular, Ionic und Capacitor unter MIT', () => {
    const mit = LIBRARIES.filter((l) => l.license === 'MIT').map((l) => l.name);
    expect(mit).toEqual(expect.arrayContaining(['Angular', 'Ionic Framework und Ionicons', 'Capacitor']));
  });
});
