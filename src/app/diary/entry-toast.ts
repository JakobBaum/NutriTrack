import { ToastController } from '@ionic/angular';

const TOAST_MS = 2500;
const TOAST_UNDO_MS = 5000;

/** Zeigt eine Meldung unten; ersetzt eine offene. Mit `onUndo` erscheint „Rückgängig“. */
export async function showEntryToast(toastCtrl: ToastController, message: string, onUndo?: () => void): Promise<void> {
  const open = await toastCtrl.getTop();
  await open?.dismiss();
  const toast = await toastCtrl.create({
    message,
    duration: onUndo ? TOAST_UNDO_MS : TOAST_MS,
    position: 'bottom',
    buttons: onUndo ? [{ text: 'Rückgängig', handler: () => onUndo() }] : [],
  });
  await toast.present();
}
