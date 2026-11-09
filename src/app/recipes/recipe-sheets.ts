import { ActionSheetController } from '@ionic/angular';
import { MealType } from '../core/models';
import { EAT_PORTION_OPTIONS, servingsLabel } from './recipe-view';

export const MEAL_OPTIONS: readonly { value: MealType; label: string }[] = [
  { value: 'breakfast', label: 'Frühstück' },
  { value: 'lunch', label: 'Mittagessen' },
  { value: 'dinner', label: 'Abendessen' },
  { value: 'snack', label: 'Snack' },
];

const CANCEL_BUTTON = { text: 'Abbrechen', role: 'cancel' } as const;

/** Name der Essenszeit für Hinweise; Fallback „Tagebuch“. */
export function mealLabel(meal: MealType): string {
  return MEAL_OPTIONS.find((m) => m.value === meal)?.label ?? 'Tagebuch';
}

/** Fragt die Essenszeit ab; null bei Abbruch. */
export async function pickMealSheet(sheets: ActionSheetController): Promise<MealType | null> {
  const sheet = await sheets.create({
    header: 'Als welche Essenszeit eintragen?',
    buttons: [...MEAL_OPTIONS.map((m) => ({ text: m.label, data: m.value })), CANCEL_BUTTON],
  });
  await sheet.present();
  const { data, role } = await sheet.onDidDismiss<MealType>();
  return role === 'cancel' || !data ? null : data;
}

/** Fragt, wie viele Portionen gegessen wurden (0,5 / 1 / 1,5 / 2); null bei Abbruch. */
export async function askPortionsSheet(sheets: ActionSheetController): Promise<number | null> {
  const sheet = await sheets.create({
    header: 'Wie viel davon hast du gegessen?',
    buttons: [...EAT_PORTION_OPTIONS.map((p) => ({ text: servingsLabel(p), data: p })), CANCEL_BUTTON],
  });
  await sheet.present();
  const { data, role } = await sheet.onDidDismiss<number>();
  return role === 'cancel' || typeof data !== 'number' ? null : data;
}

/** Karten-Menü eines Rezepts; liefert die gewählte Aktion oder undefined. */
export async function cardMenuSheet(
  sheets: ActionSheetController,
  title: string,
): Promise<'edit' | 'delete' | undefined> {
  const sheet = await sheets.create({
    header: title,
    buttons: [
      { text: 'Bearbeiten', icon: 'create-outline', data: 'edit' },
      { text: 'Löschen', icon: 'trash-outline', role: 'destructive', data: 'delete' },
      CANCEL_BUTTON,
    ],
  });
  await sheet.present();
  const { data } = await sheet.onDidDismiss<string>();
  return data === 'edit' || data === 'delete' ? data : undefined;
}
