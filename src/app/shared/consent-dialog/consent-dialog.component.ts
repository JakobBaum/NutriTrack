import { ChangeDetectionStrategy, Component, inject, signal } from '@angular/core';
import { ModalController } from '@ionic/angular/lazy';
import { ConsentStore } from '../../core/consent/consent.store';
import { EXTERNAL_CHANGE_MESSAGE, SCHEMA_NEWER_MESSAGE, WRITE_BLOCKED_MESSAGE } from '../../core/storage/storage-messages';
import { StorageService } from '../../core/storage/storage.service';
import { PrivacyModalComponent } from './privacy-modal.component';

/** Rollen, mit denen der Dialog schließt. */
export const CONSENT_ROLE_CONFIRM = 'confirm';
export const CONSENT_ROLE_CANCEL = 'cancel';

/** Dialog "KI- und Online-Funktionen": Einwilligung mit 18+-Bestätigung. Wird nur über den ConsentService geöffnet. */
@Component({
  selector: 'app-consent-dialog',
  templateUrl: './consent-dialog.component.html',
  styleUrls: ['./consent-dialog.component.scss'],
  standalone: false,
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class ConsentDialogComponent {
  private readonly modals = inject(ModalController);
  private readonly store = inject(ConsentStore);
  private readonly storage = inject(StorageService);

  /** Das Profil hat ein Alter unter 18: Zustimmung nicht möglich. */
  isMinor = false;

  readonly isAdult = signal(false);
  /** Fehlermeldung, wenn die Zustimmung nicht gespeichert werden konnte (Schreibsperre); der Dialog bleibt dann offen. */
  readonly acceptError = signal<string | null>(null);

  setAdult(checked: boolean): void {
    this.isAdult.set(checked);
  }

  accept(): void {
    if (this.isMinor || !this.isAdult()) return;
    if (!this.store.grant(new Date(), true)) {
      this.acceptError.set(this.blockedMessage());
      return;
    }
    this.acceptError.set(null);
    void this.modals.dismiss(null, CONSENT_ROLE_CONFIRM);
  }

  /** Ursache der Schreibsperre in Worten (der Hinweis oben im Banner liegt hinter dem Dialog). */
  private blockedMessage(): string {
    if (this.storage.schemaNewer()) return SCHEMA_NEWER_MESSAGE;
    if (this.storage.externalChange()) return EXTERNAL_CHANGE_MESSAGE;
    return WRITE_BLOCKED_MESSAGE;
  }

  decline(): void {
    void this.modals.dismiss(null, CONSENT_ROLE_CANCEL);
  }

  /** Die Erklärung öffnet über dem Dialog; der Dialog bleibt offen und die Anfrage wartet weiter. */
  async openPrivacy(): Promise<void> {
    const privacy = await this.modals.create({ component: PrivacyModalComponent });
    await privacy.present();
  }
}
