import { describe, expect, it } from 'vitest';
import { Recipe } from '../../models';
import { StoredRecipe, isOnlineRef, isValidOnlineRef, migrateOnlineRecipes, spoonacularIdFromImageUrl, spoonacularIdFromUrl, toRefRecord } from './online-recipe-ref';

const full = (over: Partial<Recipe> = {}): Recipe => ({
  id: 'recipe_1', title: 'Linsensuppe', servings: 4,
  ingredients: [{ name: 'Linsen', amount: 200, unit: 'g' }], steps: ['Kochen'],
  origin: 'online', sourceUrl: 'https://spoonacular.com/lentil-soup-4242', imageUrl: 'https://img.example/x.jpg',
  factsPerServing: { kcal: 300, proteinG: 10, carbsG: 40, fatG: 5, basis: 'perPortion' },
  createdAt: '2026-01-01T00:00:00.000Z', updatedAt: '2026-01-01T00:00:00.000Z', ...over,
});

describe('spoonacularIdFromUrl', () => {
  it('liest die Id am Ende eines spoonacular-Links', () => {
    expect(spoonacularIdFromUrl('https://spoonacular.com/lentil-soup-4242')).toBe('4242');
    expect(spoonacularIdFromUrl('https://www.spoonacular.com/recipes/lentil-soup-99')).toBe('99');
  });
  it('liefert null für fremde Hosts, fehlende Id und ungültige Adressen', () => {
    expect(spoonacularIdFromUrl('https://example.com/soup-4242')).toBeNull();
    expect(spoonacularIdFromUrl('https://spoonacular.com/lentil-soup')).toBeNull();
    expect(spoonacularIdFromUrl('kein link')).toBeNull();
    expect(spoonacularIdFromUrl(undefined)).toBeNull();
  });
});

describe('spoonacularIdFromImageUrl', () => {
  it('liest die Id aus Bild-Adressen von spoonacular', () => {
    expect(spoonacularIdFromImageUrl('https://img.spoonacular.com/recipes/716429-556x370.jpg')).toBe('716429');
    expect(spoonacularIdFromImageUrl('https://spoonacular.com/recipeImages/642583-312x231.jpg')).toBe('642583');
  });
  it('liefert null für fremde Hosts, falsche Pfade und Nicht-Ziffern', () => {
    expect(spoonacularIdFromImageUrl('https://img.example.com/recipes/716429-556x370.jpg')).toBeNull();
    expect(spoonacularIdFromImageUrl('https://img.spoonacular.com/ingredients/716429-556x370.jpg')).toBeNull();
    expect(spoonacularIdFromImageUrl('https://img.spoonacular.com/recipes/abc-556x370.jpg')).toBeNull();
    expect(spoonacularIdFromImageUrl('https://img.spoonacular.com/recipes/1234567890123-556x370.jpg')).toBeNull();
    expect(spoonacularIdFromImageUrl(undefined)).toBeNull();
  });
});

describe('isValidOnlineRef und isOnlineRef strikt', () => {
  const ref = { source: 'spoonacular', externalId: '4242', savedAt: '2026-11-01T10:00:00.000Z' };
  it('akzeptiert einen vollständigen Verweis', () => {
    expect(isValidOnlineRef(ref)).toBe(true);
  });
  it.each([null, 'x', [], { ...ref, source: 'other' }, { ...ref, externalId: 4242 }, { ...ref, externalId: '12a' },
    { ...ref, externalId: '1234567890123' }, { ...ref, externalId: '' }, { ...ref, savedAt: 'gestern' }, { ...ref, savedAt: 5 },
    { ...ref, savedAt: '2999-01-01T00:00:00.000Z' }])('lehnt %j ab', (bad) => {
    expect(isValidOnlineRef(bad)).toBe(false);
  });
  it('isOnlineRef wirft bei onlineRef null nicht und liefert false', () => {
    const broken = { ...full(), onlineRef: null } as unknown as StoredRecipe;
    expect(isOnlineRef(broken)).toBe(false);
  });
});

describe('toRefRecord', () => {
  it('behält nur Verweisdaten: keine Zutaten, Schritte oder Nährwerte', () => {
    const ref = toRefRecord(full(), { source: 'spoonacular', externalId: '4242', savedAt: '2026-11-01T10:00:00.000Z' });
    expect(ref.ingredients).toEqual([]);
    expect(ref.steps).toEqual([]);
    expect(ref.factsPerServing).toBeUndefined();
    expect(ref.onlineRef).toEqual({ source: 'spoonacular', externalId: '4242', savedAt: '2026-11-01T10:00:00.000Z' });
    expect(ref).toMatchObject({ id: 'recipe_1', title: 'Linsensuppe', imageUrl: 'https://img.example/x.jpg', origin: 'online' });
    expect(isOnlineRef(ref)).toBe(true);
  });
});

describe('migrateOnlineRecipes', () => {
  it('reduziert unbearbeitete, vollständig gespeicherte Online-Rezepte auf den Verweis', () => {
    const { recipes, changed } = migrateOnlineRecipes([full()]);
    expect(changed).toBe(true);
    expect(recipes[0].ingredients).toEqual([]);
    expect(recipes[0].factsPerServing).toBeUndefined();
    expect(recipes[0].onlineRef?.externalId).toBe('4242');
    expect(recipes[0].onlineRef?.savedAt).toBe('2026-01-01T00:00:00.000Z');
  });

  it('ist idempotent', () => {
    const once = migrateOnlineRecipes([full()]).recipes;
    const twice = migrateOnlineRecipes(once);
    expect(twice.changed).toBe(false);
    expect(twice.recipes).toEqual(once);
  });

  it('lässt eigene, importierte und bearbeitete Rezepte unverändert', () => {
    const own = full({ id: 'a', origin: 'own' });
    const imported = full({ id: 'b', origin: 'url' });
    const edited = full({ id: 'c', updatedAt: '2026-02-01T00:00:00.000Z' });
    const { recipes, changed } = migrateOnlineRecipes([own, imported, edited]);
    expect(changed).toBe(false);
    expect(recipes).toEqual([own, imported, edited]);
  });

  it('leitet die Id aus der Bild-Adresse ab, wenn sourceUrl die Originalseite ist', () => {
    const recipe = full({ sourceUrl: 'https://blog.example/soup', imageUrl: 'https://img.spoonacular.com/recipes/716429-556x370.jpg' });
    const { recipes, changed } = migrateOnlineRecipes([recipe]);
    expect(changed).toBe(true);
    expect(recipes[0].onlineRef?.externalId).toBe('716429');
  });

  it('lässt Online-Rezepte ohne wiederfindbare Id vollständig (kein Datenverlust)', () => {
    const noId = full({ sourceUrl: 'https://blog.example/soup' });
    const { recipes, changed } = migrateOnlineRecipes([noId]);
    expect(changed).toBe(false);
    expect(recipes[0].ingredients.length).toBe(1);
  });

  it('erkennt ein vollständiges Rezept ohne onlineRef nicht als Verweis', () => {
    const edited: StoredRecipe = full();
    expect(isOnlineRef(edited)).toBe(false);
  });
});
