import { ActionSheetButton, ActionSheetController } from '@ionic/angular';

export type EntryAction = 'edit' | 'duplicate' | 'delete';

/** Buttons des „Mehr“-Menüs einer Tagebuch-Zeile (sichtbarer Ersatz für Wischen und Hover). */
export function entryMenuButtons(pick: (action: EntryAction) => void): ActionSheetButton[] {
  return [
    { text: 'Bearbeiten', icon: 'create-outline', handler: () => pick('edit') },
    { text: 'Doppelt eintragen', icon: 'copy-outline', handler: () => pick('duplicate') },
    { text: 'Löschen', icon: 'trash-outline', role: 'destructive', handler: () => pick('delete') },
    { text: 'Abbrechen', role: 'cancel' },
  ];
}

/** Zeigt das Menü zu einem Eintrag; liefert die gewählte Aktion oder null bei Abbruch. */
export async function pickEntryAction(sheets: ActionSheetController, label: string): Promise<EntryAction | null> {
  let picked: EntryAction | null = null;
  const sheet = await sheets.create({
    header: label,
    buttons: entryMenuButtons((action) => {
      picked = action;
    }),
  });
  await sheet.present();
  await sheet.onDidDismiss();
  return picked;
}
