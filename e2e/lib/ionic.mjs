// Ionic-spezifische Locator-Helfer (Modals, ion-input, Toasts, Action-Sheets).
import { settle } from './harness.mjs';

/** Oberstes sichtbares Modal. */
export const topModal = (page) => page.locator('ion-modal.show-modal').last();

/** Natives <input> eines ion-input anhand seines Label-Texts (exakt, ohne Groß/Klein). */
export function ionInput(scope, label) {
  const exact = new RegExp(`^\\s*${label.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}\\s*$`, 'i');
  return scope.locator('ion-input').filter({ has: scope.page().locator('.label-text', { hasText: exact }) }).locator('input');
}

/** ion-segment-button anhand seines Texts (value ist Property, kein Attribut). */
export const segmentButton = (scope, text) =>
  scope.locator('ion-segment-button').filter({ hasText: new RegExp(`^\\s*${text}\\s*$`) });

/** Füllt ein Feld und verlässt es (für ngModelOptions updateOn: 'blur'). */
export async function fillAndBlur(input, value) {
  await input.click();
  await input.fill(value);
  await input.press('Tab');
}

/** Klickt einen Toast-Button (z. B. „Rückgängig“) im Shadow-DOM des ion-toast. */
export async function clickToastButton(page, text) {
  const btn = page.locator('ion-toast button', { hasText: text }).last();
  await btn.waitFor();
  await btn.click();
  await settle(page, 400);
}

/** Schließt alle offenen Toasts und wartet, bis sie weg sind (ein Toast kann Buttons am unteren Rand überdecken). */
export async function dismissToasts(page) {
  await page.evaluate(() => Promise.all([...document.querySelectorAll('ion-toast')].map((t) => t.dismiss?.())));
  await page.locator('ion-toast').first().waitFor({ state: 'detached', timeout: 3000 }).catch(() => undefined);
}

/**
 * Klickt robust: bewegt sich das Element noch (Sheet-Animation, "not stable"), wird kurz gewartet und neu versucht;
 * erst der letzte Versuch klickt ohne Stabilitätsprüfung.
 */
export async function stableClick(locator, { attempts = 4, pauseMs = 250 } = {}) {
  for (let i = 1; i <= attempts; i++) {
    try {
      await locator.click({ timeout: i === attempts ? 4000 : 1500, force: i === attempts });
      return;
    } catch (e) {
      if (i === attempts) throw e;
      await locator.page().waitForTimeout(pauseMs);
    }
  }
}

export const toastMessage =(page) => page.locator('ion-toast .toast-message').last();

/** Wählt einen Eintrag im ion-action-sheet. */
export async function pickActionSheet(page, text) {
  const btn = page.locator('ion-action-sheet button', { hasText: text }).first();
  await btn.waitFor();
  await btn.click();
  await settle(page, 400);
}

/** Natives <input> einer Mengenzeile (app-amount-row) anhand ihres Labels. */
export function amountInput(scope, label) {
  const exact = new RegExp(`^\\s*${label.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}\\s*$`, 'i');
  return scope.locator('app-amount-row').filter({ has: scope.page().locator('.amount__label', { hasText: exact }) }).locator('input');
}

/** Wählt die Einheit über den Einheiten-Button der Mengenzeile (Action-Sheet). */
export async function pickUnit(page, scope, unit) {
  await scope.locator('.amount__unit').click();
  const btn = page.locator('ion-action-sheet button', { hasText: new RegExp('^\s*' + unit + '\s*$') }).first();
  await btn.waitFor();
  await btn.click();
  await settle(page, 400);
}

/** Setzt einen nt-stepper per −/+. Leer: erstes Tippen springt auf `start`; sonst Schritte ab aktuellem Wert. */
export async function stepTo(scope, label, { start, step, target }) {
  const page = scope.page();
  const stepper = scope.locator(`nt-stepper[label="${label}"]`);
  const btn = (dir) => stepper.locator(`button[aria-label="${label} ${dir}"]`);
  const shown = (await stepper.locator('.stepper__value').innerText()).trim();
  let current = start;
  if (shown.startsWith('–')) {
    await stableClick(btn('erhöhen'));
    await settle(page, 150);
  } else {
    current = parseFloat(shown.replace(',', '.'));
  }
  const diff = Math.round((target - current) / step);
  for (let n = 0; n < Math.abs(diff); n++) {
    await stableClick(btn(diff > 0 ? 'erhöhen' : 'verringern'));
    await settle(page, 150);
  }
}
