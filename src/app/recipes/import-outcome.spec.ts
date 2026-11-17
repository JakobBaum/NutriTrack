import { describe, expect, it } from 'vitest';
import { importOutcome } from './import-outcome';

const res = { title: 'T', servings: 2, ingredients: [], steps: [], sourceUrl: 'https://a.test/r' };

describe('importOutcome', () => {
  it('merkt sich bei Link-Import die Quelle', () => {
    const out = importOutcome(res, { url: 'https://a.test/r', isTikTok: false, isLive: true });

    expect(out).toMatchObject({ origin: 'url', sourceUrl: 'https://a.test/r' });
    expect(out.toast).toMatch(/importiert/);
  });

  it('unterscheidet TikTok, Text und Offline-Text', () => {
    expect(importOutcome(res, { url: 'https://tiktok.com/x', isTikTok: true, isLive: true }).origin).toBe('tiktok');
    expect(importOutcome(res, { url: 'https://tiktok.com/x', isTikTok: true, isLive: true }).toast).toMatch(/TikTok/);
    expect(importOutcome(res, { url: '', isTikTok: false, isLive: true })).toMatchObject({ origin: 'text', sourceUrl: undefined });
    expect(importOutcome(res, { url: '', isTikTok: false, isLive: false }).toast).toMatch(/aus Text/);
  });

  it('speichert bei Rückfall auf den Text keine Quelle und sagt es dem Nutzer', () => {
    const out = importOutcome({ ...res, usedFallbackText: true }, { url: 'https://a.test/r', isTikTok: false, isLive: true });

    expect(out.origin).toBe('text');
    expect(out.sourceUrl).toBeUndefined();
    expect(out.toast).toMatch(/Link war nicht abrufbar/);
  });

  it('ignoriert usedFallbackText ohne Link', () => {
    const out = importOutcome({ ...res, usedFallbackText: true }, { url: '', isTikTok: false, isLive: true });

    expect(out.toast).toMatch(/importiert/);
  });
});
