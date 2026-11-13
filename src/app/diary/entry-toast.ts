import { ToastController } from '@ionic/angular';
import { TOAST_SWIPE_GESTURE } from '../shared/toast-options';

const TOAST_MS = 2500;
const TOAST_UNDO_MS = 3500;

/** Zeigt eine Meldung oben (nie über dem Hauptbutton unten im Sheet); ersetzt eine offene. Mit `onUndo` erscheint „Rückgängig“. */
export async function showEntryToast(toastCtrl: ToastController, message: string, onUndo?: () => void): Promise<void> {
  const open = await toastCtrl.getTop();
  await open?.dismiss();
  const toast = await toastCtrl.create({
    message,
    duration: onUndo ? TOAST_UNDO_MS : TOAST_MS,
    position: 'top',
    swipeGesture: TOAST_SWIPE_GESTURE,
    buttons: onUndo ? [{ text: 'Rückgängig', handler: () => onUndo() }] : [],
  });
  await toast.present();
}
