import { Component, effect, inject, untracked } from '@angular/core';
import { ToastController } from '@ionic/angular';
import { StorageService } from './core/storage/storage.service';

/** Meldung, wenn der Gerätespeicher das Schreiben verweigert (QAE-02). */
export const STORAGE_WRITE_ERROR_MESSAGE =
  'Konnte nicht gespeichert werden — der Speicher ist voll oder gesperrt. Lege ein Backup an und gib Platz frei.';
const STORAGE_ERROR_TOAST_MS = 6000;

@Component({
  selector: 'app-root',
  templateUrl: 'app.component.html',
  styleUrls: ['app.component.scss'],
  standalone: false,
})
export class AppComponent {
  private readonly storage = inject(StorageService);
  private readonly toastCtrl = inject(ToastController);

  constructor() {
    effect(() => {
      const failures = this.storage.writeFailures();
      if (failures > 0) untracked(() => void this.showStorageError());
    });
  }

  private async showStorageError(): Promise<void> {
    const toast = await this.toastCtrl.create({
      message: STORAGE_WRITE_ERROR_MESSAGE,
      duration: STORAGE_ERROR_TOAST_MS,
      position: 'top',
      color: 'danger',
    });
    await toast.present();
  }
}
