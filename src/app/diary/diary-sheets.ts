import { ActionSheetController } from '@ionic/angular';
import { MealType } from '../core/models';
import { MEAL_DEFS } from './diary-helpers';

/** Fragt „Verwerfen?“ als Action-Sheet; true = Eingaben verwerfen und schließen. */
export async function confirmDiscardSheet(sheets: ActionSheetController): Promise<boolean> {
  const sheet = await sheets.create({
    header: 'Verwerfen?',
    subHeader: 'Deine Eingaben sind noch nicht gespeichert.',
    buttons: [
      { text: 'Verwerfen', role: 'destructive' },
      { text: 'Weiter bearbeiten', role: 'cancel' },
    ],
  });
  await sheet.present();
  const { role } = await sheet.onDidDismiss();
  return role === 'destructive';
}

/** Essenszeit per Action-Sheet wählen; null bei Abbruch. */
export async function pickMealSheet(sheets: ActionSheetController, current: MealType): Promise<MealType | null> {
  let picked: MealType | null = null;
  const sheet = await sheets.create({
    header: 'Essenszeit',
    buttons: [
      ...MEAL_DEFS.map((m) => ({
        text: m.label,
        role: m.type === current ? 'selected' : undefined,
        handler: () => {
          picked = m.type;
        },
      })),
      { text: 'Abbrechen', role: 'cancel' },
    ],
  });
  await sheet.present();
  await sheet.onDidDismiss();
  return picked;
}
