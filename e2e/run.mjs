// E2E-Einstieg: node e2e/run.mjs [filter]  — erwartet laufenden Dev-Server (E2E_BASE_URL, Standard :4300).
import fs from 'node:fs';
import path from 'node:path';
import { ARTIFACTS, BASE_URL, createRunner, launchBrowser } from './lib/harness.mjs';
import * as diary from './specs/diary.spec.mjs';
import * as recipes from './specs/recipes.spec.mjs';
import * as app from './specs/app.spec.mjs';
import * as weekplan from './specs/weekplan.spec.mjs';
import * as weight from './specs/weight.spec.mjs';
import * as week from './specs/week.spec.mjs';
import * as favorites from './specs/favorites.spec.mjs';
import * as search from './specs/search.spec.mjs';

const filter = process.argv[2] ?? '';

async function assertServerUp() {
  try {
    const res = await fetch(BASE_URL);
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
  } catch (e) {
    console.error(`Dev-Server unter ${BASE_URL} nicht erreichbar (${e.message}). Erst "npm start" starten.`);
    process.exit(2);
  }
}

await assertServerUp();
const browser = await launchBrowser();
const runner = createRunner(browser);
const test = (name, seed, fn) => (name.includes(filter) ? runner.test(name, seed, fn) : Promise.resolve());

// Tests registrieren und nacheinander ausführen
const queue = [];
for (const spec of [app, diary, recipes, weekplan, weight, week, favorites, search]) spec.register({ test: (...args) => queue.push(args) });
for (const args of queue) await test(...args);
await browser.close();

const failed = runner.results.filter((r) => !r.ok);
fs.writeFileSync(path.join(ARTIFACTS, 'results.json'), JSON.stringify(runner.results, null, 2));
console.log(`\n${runner.results.length - failed.length}/${runner.results.length} bestanden`);
process.exit(failed.length ? 1 : 0);
