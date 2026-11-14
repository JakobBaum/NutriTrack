import { Injectable, Injector, inject } from '@angular/core';
import { ModalController } from '@ionic/angular/lazy';
import { ProfileStore } from '../state/profile.store';
import { ConsentDialogComponent } from '../../shared/consent-dialog/consent-dialog.component';
import { ConsentStore } from './consent.store';
import { isUnderAge } from './consent.model';

const DIALOG_CSS_CLASS = 'nt-consent-modal';

/**
 * Holt die Zustimmung zu den KI- und Online-Funktionen ein. Der einzige Weg, einen Dialog zu öffnen:
 * gleichzeitige Aufrufe teilen sich denselben Dialog.
 */
@Injectable({ providedIn: 'root' })
export class ConsentService {
  private readonly store = inject(ConsentStore);
  private readonly profile = inject(ProfileStore);
  private readonly injector = inject(Injector);
  private pending: Promise<boolean> | null = null;

  /** Sofortige Prüfung ohne Dialog (für Hintergrundaufrufe). */
  isGranted(): boolean {
    return this.store.granted();
  }

  /** Das gespeicherte Profil hat ein Alter unter 18: eine Zustimmung ist dann nicht möglich. */
  isMinor(): boolean {
    return isUnderAge(this.profile.profile()?.age);
  }

  /** `true`, sobald zugestimmt ist; sonst Dialog und dessen Ergebnis. */
  ensure(): Promise<boolean> {
    if (this.store.granted()) return Promise.resolve(true);
    if (this.pending) return this.pending;
    const job = this.askUser().finally(() => {
      this.pending = null;
    });
    this.pending = job;
    return job;
  }

  private async askUser(): Promise<boolean> {
    try {
      // Erst beim Öffnen holen: der Dienst wird auch ohne Ionic-Modul (Tests, Logik) erzeugt.
      const modals = this.injector.get(ModalController);
      const modal = await modals.create({
        component: ConsentDialogComponent,
        componentProps: { isMinor: this.isMinor() },
        cssClass: DIALOG_CSS_CLASS,
        backdropDismiss: true,
      });
      await modal.present();
      const { role } = await modal.onWillDismiss();
      return role === 'confirm' && this.store.granted();
    } catch (e: unknown) {
      console.error('NutriTrack: Zustimmungsdialog konnte nicht geöffnet werden', e);
      return false;
    }
  }
}
