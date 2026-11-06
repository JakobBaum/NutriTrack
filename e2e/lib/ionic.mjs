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

export const toastMessage = (page) => page.locator('ion-toast .toast-message').last();

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
