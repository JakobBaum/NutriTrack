// Wochenplan: Rezepte (gemockt, Spoonacular) erzeugen, Karten, Zutaten in der Liste, Favoriten, Kochmodus.
import { assert, eventually, go, readStore, settle } from '../lib/harness.mjs';
import { dismissToasts, stableClick, topModal } from '../lib/ionic.mjs';
import { seed } from '../lib/fixtures.mjs';

const CORS = { 'access-control-allow-origin': '*', 'access-control-allow-headers': '*', 'access-control-expose-headers': 'X-Api-Quota-Left' };
const RESULTS_PER_TYPE = 12;

const typeSeed = (type) => [...String(type)].reduce((sum, ch) => sum + ch.charCodeAt(0), 0) * 100;

// Spoonacular liefert englische Originaltitel; der Mock nutzt neutrale Titel ohne Nummern-Suffix.
const MOCK_TITLES = ['Red Lentil Dal', 'Chicken Quinoa Bowl', 'Tofu Stir Fry', 'Greek Yogurt Pancakes', 'Baked Salmon with Greens', 'Chickpea Curry'];

function mockRecipe(id, type) {
  return {
    id,
    title: MOCK_TITLES[id % MOCK_TITLES.length],
    image: 'data:image/gif;base64,R0lGODlhAQABAAAAACw=',
    readyInMinutes: 25,
    servings: 2,
    sourceName: 'Mock Blog',
    sourceUrl: `https://blog.example/${id}`,
    nutrition: {
      nutrients: [
        { name: 'Calories', amount: 450, unit: 'kcal' }, { name: 'Protein', amount: 38, unit: 'g' },
        { name: 'Fat', amount: 12, unit: 'g' }, { name: 'Carbohydrates', amount: 40, unit: 'g' },
      ],
    },
    extendedIngredients: [
      { id: 1, name: 'lentils', nameClean: 'red lentils', amount: 200, unit: 'g', measures: { metric: { amount: 200, unitShort: 'g' } } },
      { id: 2, name: 'onion', amount: 1, unit: '', measures: { metric: { amount: 1, unitShort: '' } } },
    ],
    analyzedInstructions: [{ name: '', steps: [{ number: 1, step: `Zwiebel schneiden ${id}.` }, { number: 2, step: 'Linsen 20 Minuten kochen.' }] }],
  };
}

async function mockSpoonacular(page) {
  const requests = [];
  await page.route('https://*.workers.dev/recipes/**', async (route) => {
    const req = route.request();
    if (req.method() === 'OPTIONS') return route.fulfill({ status: 204, headers: CORS });
    const url = new URL(req.url());
    requests.push(url);
    const type = url.searchParams.get('type') ?? 'any';
    const results = Array.from({ length: RESULTS_PER_TYPE }, (_, i) => mockRecipe(typeSeed(type) + requests.length * RESULTS_PER_TYPE + i, type));
    return route.fulfill({
      status: 200,
      headers: { ...CORS, 'content-type': 'application/json' },
      body: JSON.stringify({ offset: 0, number: results.length, totalResults: results.length, results }),
    });
  });
  return requests;
}

async function openRecipes(page) {
  await page.locator('ion-segment-button', { hasText: 'Wochenplan' }).first().click();
  await settle(page);
}

async function createPlan(page) {
  await go(page, 'shopping');
  await openRecipes(page);
  await page.locator('[data-testid="week-plan-btn"]').click();
  await page.locator('.wp-card').first().waitFor();
}

const SEEDED = () => seed({});

export function register({ test }) {
  test('weekplan: erstellen zeigt Rezeptkarten, Anfragen mit Protein-Filter', SEEDED(), async (page) => {
    const requests = await mockSpoonacular(page);
    await createPlan(page);

    assert.ok(requests.length >= 2, 'eine Anfrage je Mahlzeit erwartet');
    for (const url of requests) {
      assert.ok(url.searchParams.get('type'), 'type fehlt');
      assert.equal(url.searchParams.get('sort'), 'healthiness');
      assert.ok(Number(url.searchParams.get('minProtein')) >= 1, 'minProtein fehlt');
    }
    const plan = await readStore(page, 'week-plan');
    assert.ok(plan.recipes.length >= 2);
    assert.equal(new Set(plan.recipes.map((r) => r.id)).size, plan.recipes.length, 'doppelte Rezepte im Plan');
    const cards = page.locator('.wp-card');
    assert.equal(await cards.count(), plan.recipes.length);
    assert.match(await cards.first().innerText(), /38 g Eiweiß/);
  });

  test('weekplan: alle Zutaten landen in der Liste, Ansicht bleibt bei Rezepten', SEEDED(), async (page) => {
    await mockSpoonacular(page);
    await createPlan(page);

    await eventually(async () => assert.ok((await readStore(page, 'shopping'))?.items?.length > 0, 'Liste leer'));
    const names = (await readStore(page, 'shopping')).items.map((i) => i.name.toLowerCase());
    assert.ok(names.some((n) => n.includes('linsen')), `Linsen fehlen: ${names.join(', ')}`);
    assert.ok(await page.locator('.wp-card').first().isVisible(), 'Ansicht darf nicht automatisch wechseln');

    await page.locator('ion-segment-button', { hasText: 'Liste' }).first().click();
    await settle(page);
    assert.match(await page.locator('ion-content').first().innerText(), /linsen/i);
    assert.equal(await page.locator('.wp-card').count(), 0, 'Liste zeigt nur Zutaten');
  });

  test('weekplan: Karte öffnen, zu Favoriten, Kochen mit Zutaten und Schritten', SEEDED(), async (page) => {
    await mockSpoonacular(page);
    await createPlan(page);

    await page.locator('.wp-card').first().click();
    const detail = page.locator('[data-testid="wp-detail"]');
    await detail.waitFor();
    const title = (await detail.locator('.wp-detail__title').innerText()).trim();
    assert.match(await detail.innerText(), /Eiweiß/);

    await dismissToasts(page);
    await stableClick(detail.locator('.wp-fav'));
    await settle(page);
    const saved = (await readStore(page, 'recipes')).find((r) => r.title === title);
    assert.ok(saved, 'Rezept nicht in Favoriten');
    assert.equal(saved.origin, 'online');
    assert.equal(await detail.locator('.wp-fav').isDisabled(), true, 'Button nach Speichern nicht deaktiviert');
    assert.match(await detail.locator('.wp-fav').innerText(), /Gespeichert/);

    await dismissToasts(page);
    await stableClick(detail.locator('.wp-cook'));
    const ingredients = page.locator('[data-testid="cook-ingredients"]');
    await ingredients.waitFor();
    assert.match(await ingredients.innerText(), /linsen/i);
    await dismissToasts(page);
    await stableClick(page.locator('.cook__nav-btn--next'));
    const step = page.locator('[data-testid="cook-step"]');
    await step.waitFor();
    assert.match(await step.innerText(), /Zwiebel schneiden/);
    assert.ok(topModal(page), 'Modal fehlt');
  });

  test('weekplan: Kontingent erschöpft zeigt Fehlermeldung, kein Plan', SEEDED(), async (page) => {
    await page.route('https://*.workers.dev/recipes/**', async (route) => {
      if (route.request().method() === 'OPTIONS') return route.fulfill({ status: 204, headers: CORS });
      return route.fulfill({ status: 402, headers: CORS, body: '{}' });
    });
    await go(page, 'shopping');
    await openRecipes(page);
  await page.locator('[data-testid="week-plan-btn"]').click();
    await settle(page, 800);

    assert.equal(await page.locator('.wp-card').count(), 0);
    assert.equal(await readStore(page, 'week-plan'), null);
    assert.match(await page.locator('ion-content').first().innerText(), /Limit|Kontingent|Punkte|heute/i);
  });
}
