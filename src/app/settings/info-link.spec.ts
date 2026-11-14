import { describe, expect, it } from 'vitest';
import { DefaultUrlSerializer } from '@angular/router';
import { PRIVACY_INFO_URL, infoLinkSection, parseInfoSection } from './info-link';

describe('parseInfoSection', () => {
  it.each(['anleitung', 'datenschutz', 'quellen', 'agb', 'hilfe'])('erkennt %s', (id) => {
    expect(parseInfoSection(id)).toBe(id);
  });

  it.each([null, undefined, '', 'impressum', 42, ['datenschutz']])('liefert null für %j', (value) => {
    expect(parseInfoSection(value)).toBeNull();
  });

  it('der Datenschutz-Link nennt den Abschnitt datenschutz', () => {
    expect(PRIVACY_INFO_URL).toBe('/settings?info=datenschutz');
  });
});

describe('infoLinkSection', () => {
  const router = { parseUrl: (url: string) => new DefaultUrlSerializer().parse(url) };
  const parse = (url: string) => infoLinkSection(router.parseUrl(url));

  it('liest den Abschnitt aus dem Einstellungslink', () => {
    expect(parse(PRIVACY_INFO_URL)).toBe('datenschutz');
  });

  it('ignoriert unbekannte Abschnitte und andere Seiten', () => {
    expect(parse('/settings?info=impressum')).toBeNull();
    expect(parse('/diary?info=datenschutz')).toBeNull();
    expect(parse('/settings')).toBeNull();
  });
});
