// Wochenansicht im Tagebuch: Segment Tag/Woche, Mittelwerte, Balken mit Ziel-Linie.
import { assert, eventually, go } from '../lib/harness.mjs';
import { segmentButton } from '../lib/ionic.mjs';
import { daysAgoISO, entryOn, facts, seed } from '../lib/fixtures.mjs';

/** Zwei volle Tage (gestern, vorgestern), heute nichts. */
const WEEK_DIARY = [
  entryOn(daysAgoISO(1), 'w1', 'Tag A', facts(2400, 140, 250, 80)),
  entryOn(daysAgoISO(2), 'w2', 'Tag B', facts(2400, 140, 250, 80)),
];

export function register({ test }) {
  test('week: Segment Woche zeigt Statistik und Balken', seed({ diary: WEEK_DIARY }), async (page) => {
    await go(page, 'diary');
    await segmentButton(page, 'Woche').click();
    await page.locator('[data-testid="week-view"]').waitFor();
    await eventually(async () => assert.match(await page.locator('[data-testid="week-avg-kcal"]').innerText(), /2\D?400/));
    assert.equal(await page.locator('[data-testid="week-kcal-chart"] .bars__bar').count(), 7);
    assert.equal(await page.locator('[data-testid="week-kcal-chart"] .bars__target').count(), 1, 'Ziel-Linie fehlt');
    assert.equal(await page.locator('[data-testid="week-protein-chart"] .bars__bar').count(), 7);
  });

  test('week: Zurück zu Tag zeigt wieder die Tagesansicht', seed({ diary: WEEK_DIARY }), async (page) => {
    await go(page, 'diary');
    await segmentButton(page, 'Woche').click();
    await page.locator('[data-testid="week-view"]').waitFor();
    await segmentButton(page, 'Tag').click();
    await eventually(async () => assert.equal(await page.locator('[data-testid="week-view"]').count(), 0));
    await page.locator('nt-date-nav').waitFor();
  });
}
