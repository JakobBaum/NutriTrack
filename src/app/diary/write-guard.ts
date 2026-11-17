import { ToastController } from '@ionic/angular';
import { WRITE_BLOCKED_MESSAGE } from '../core/storage/storage-messages';
import { showEntryToast } from './entry-toast';

/** Minimale Schnittstelle der Stores: nur die Schreibsperre. */
export interface WriteLockable {
  isReadOnly(): boolean;
}

/**
 * Prüft vor dem Schreiben die Schreibsperre. Bei Sperre erscheint die Sperrmeldung statt eines
 * Erfolgs-Toasts, nichts wird eingetragen; Rückgabe false.
 */
export function ensureWritable(store: WriteLockable, toastCtrl: ToastController): boolean {
  if (!store.isReadOnly()) return true;
  void showEntryToast(toastCtrl, WRITE_BLOCKED_MESSAGE);
  return false;
}
