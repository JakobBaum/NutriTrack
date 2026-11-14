// Welle 3: Kochmodus mit Utensilien auf der ersten Seite und Zutaten (mit Menge) je Schritt.
import { assert, go, settle } from '../lib/harness.mjs';
import { seed } from '../lib/fixtures.mjs';

const VIEWPORTS = [{ width: 375, height: 667 }, { width: 320, height: 568 }];
const STAMP = new Date().toISOString();

const RECIPE = {
  id: 'r-cook', title: 'Zwiebelreis mit Ei', servings: 2, origin: 'manual', createdAt: STAMP, updatedAt: STAMP,
  ingredients: [
    { id: 'i1', name: 'Zwiebel', amount: 2, unit: 'Stk' },
    { id: 'i2', name: 'Reis', amount: 200, unit: 'g' },
    { id: 'i3', name: 'Olivenöl', amount: 2, unit: 'EL' },
    { id: 'i4', name: 'Ei', amount: 2, unit: 'Stk' },
  ],
  steps: [
    'Die Zwiebeln fein würfeln und in einer Pfanne mit Olivenöl anbraten.',
    'Den Reis zugeben und mit Wasser in einem Topf 15 Minuten kochen.',
    'Das Ei einrühren und servieren.',
  ],
};

async function startCook(page, viewport, title = RECIPE.title) {
  await page.setViewportSize(viewport);
  await go(page, 'recipes');
  await page.locator('article.recipe', { hasText: title }).locator('ion-button', { hasText: 'Kochen' }).click();
  await page.locator('.cook__close').waitFor();
  await settle(page, 700);
}

const next = async (page) => {
  await page.locator('.cook__nav-btn--next').click();
  await settle(page, 300);
};

/** Meldet Seitenüberlauf und Elemente, die rechts aus dem Bildschirm ragen. */
const overflow = (page) => page.evaluate(() => {
  const vw = window.innerWidth;
  const root = document.querySelector('.cook');
  const out = [];
  if (document.documentElement.scrollWidth > vw) out.push(`Seite ${document.documentElement.scrollWidth - vw}px zu breit`);
  if (root.scrollWidth > root.clientWidth) out.push(`.cook scrollt horizontal (${root.scrollWidth} > ${root.clientWidth})`);
  for (const el of root.querySelectorAll('*')) {
    const r = el.getBoundingClientRect();
    if (r.width > 0 && r.right > vw + 1) out.push(`${el.className || el.tagName} ragt heraus (${Math.round(r.right)} > ${vw})`);
  }
  return out;
});

const bodyText = (page) => page.locator('.cook__body').innerText();

export function register({ test }) {
  for (const vp of VIEWPORTS) {
    const at = `${vp.width}px`;

    test(`w3 koch ${at}: erste Seite zeigt Utensilien und Zutaten ohne Überlauf`, seed({ recipes: [RECIPE] }), async (page) => {
      await startCook(page, vp);
      const utensils = page.locator('[data-testid="cook-utensils"]');
      await utensils.waitFor();
      const text = await utensils.innerText();
      assert.match(text, /Du brauchst/i);
      for (const name of ['Messer und Schneidebrett', 'Pfanne', 'Topf']) assert.ok(text.includes(name), `Utensil fehlt: ${name}`);
      assert.ok(!text.includes('Backofen'), 'Backofen ist kein Utensil dieses Rezepts');
      const ingredients = await page.locator('[data-testid="cook-ingredients"]').innerText();
      assert.match(ingredients, /Reis/);
      assert.match(ingredients, /200\s*g/);
      assert.deepEqual(await overflow(page), []);
    });

    test(`w3 koch ${at}: Schritt zeigt nur passende Zutaten mit Menge, Text bleibt Hauptelement`, seed({ recipes: [RECIPE] }), async (page) => {
      await startCook(page, vp);
      await next(page);
      const step1 = page.locator('[data-testid="cook-step-ingredients"]');
      const t1 = await step1.innerText();
      assert.match(t1, /Dafür brauchst du/i);
      assert.match(t1, /2\s*(Stk|Stück)?\s*Zwiebel/);
      assert.match(t1, /2\s*EL\s*Olivenöl|Olivenöl/);
      assert.ok(!t1.includes('Reis'), 'Reis kommt in Schritt 1 nicht vor');
      assert.deepEqual(await overflow(page), []);
      const sizes = await page.evaluate(() => ({
        text: parseFloat(getComputedStyle(document.querySelector('[data-testid="cook-step"]')).fontSize),
        block: parseFloat(getComputedStyle(document.querySelector('.cook__step-ingredients li')).fontSize),
      }));
      assert.ok(sizes.text > sizes.block, `Schritttext (${sizes.text}px) soll größer sein als der Zutatenblock (${sizes.block}px)`);

      await next(page);
      const t2 = await page.locator('[data-testid="cook-step-ingredients"]').innerText();
      assert.match(t2, /200\s*g/);
      assert.match(t2, /Reis/);
      assert.ok(!/Ei\b/.test(t2.replace('Reis', '')), `Ei darf nicht in Reis/kochen treffen: ${t2}`);
      assert.deepEqual(await overflow(page), []);
    });

    test(`w3 koch ${at}: Schritt ohne Zutat zeigt keinen Block, Ei im letzten Schritt`, seed({ recipes: [RECIPE] }), async (page) => {
      await startCook(page, vp);
      await next(page); await next(page); await next(page);
      const t3 = await page.locator('[data-testid="cook-step-ingredients"]').innerText();
      assert.match(t3, /Ei/);
      assert.ok(!t3.includes('Reis') && !t3.includes('Zwiebel'));
      assert.match(await bodyText(page), /Das Ei einrühren/);
      assert.deepEqual(await overflow(page), []);
    });
  }

  const NO_MATCH = { ...RECIPE, id: 'r-plain', title: 'Nur Text', ingredients: [{ id: 'x', name: 'Zimt', amount: 1, unit: 'Prise' }], steps: ['Alles gut mischen und genießen.'] };

  test('w3 koch: ohne Treffer kein Block "Dafür brauchst du" und keine Utensilien', seed({ recipes: [NO_MATCH] }), async (page) => {
    await startCook(page, VIEWPORTS[0], NO_MATCH.title);
    assert.equal(await page.locator('[data-testid="cook-utensils"]').count(), 0);
    await next(page);
    assert.equal(await page.locator('[data-testid="cook-step-ingredients"]').count(), 0);
  });
}
