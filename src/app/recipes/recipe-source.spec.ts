import { describe, expect, it } from 'vitest';
import { recipeSourceView, safeLinkUrl } from './recipe-source';

describe('safeLinkUrl', () => {
  it.each(['https://example.org/rezept', 'http://example.org/a?b=1'])('lässt %s zu', (url) => {
    expect(safeLinkUrl(url)).toBe(url);
  });

  it.each(['javascript:alert(1)', 'data:text/html,x', 'ftp://example.org', 'kein link', '', undefined, null])(
    'verwirft %s',
    (url) => {
      expect(safeLinkUrl(url as string | undefined)).toBeNull();
    },
  );
});

describe('recipeSourceView', () => {
  it('liefert null ohne gespeicherte Quelle und ohne Online-Herkunft', () => {
    expect(recipeSourceView({ origin: 'own' })).toBeNull();
  });

  it('nennt den Host als Quelle und verlinkt bei https', () => {
    const view = recipeSourceView({ origin: 'url', sourceUrl: 'https://www.beispiel.at/rezept/1' });
    expect(view).toEqual({ name: 'beispiel.at', url: 'https://www.beispiel.at/rezept/1', showSpoonacular: false });
  });

  it('zeigt die Quelle als reinen Text, wenn die Adresse nicht http oder https ist', () => {
    const view = recipeSourceView({ origin: 'url', sourceUrl: 'javascript:alert(1)' });
    expect(view).toEqual({ name: 'javascript:alert(1)', url: null, showSpoonacular: false });
  });

  it('kürzt sehr lange Quellen', () => {
    const view = recipeSourceView({ origin: 'url', sourceUrl: 'x'.repeat(300) });
    expect(view?.name?.length ?? 0).toBeLessThanOrEqual(80);
    expect(view?.url).toBeNull();
  });

  it('nennt bei Online-Rezepten spoonacular.com, auch ohne eigene Quelle', () => {
    expect(recipeSourceView({ origin: 'online' })).toEqual({ name: null, url: null, showSpoonacular: true });
  });

  it('kombiniert Quelle und spoonacular-Hinweis', () => {
    const view = recipeSourceView({ origin: 'online', sourceUrl: 'https://spoonacular.com/recipes/x-1' });
    expect(view).toEqual({ name: 'spoonacular.com', url: 'https://spoonacular.com/recipes/x-1', showSpoonacular: true });
  });
});
