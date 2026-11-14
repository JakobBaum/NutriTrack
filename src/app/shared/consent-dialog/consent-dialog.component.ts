import { ChangeDetectionStrategy, Component, inject, signal } from '@angular/core';
import { ModalController } from '@ionic/angular/lazy';
import { ConsentStore } from '../../core/consent/consent.store';
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

  /** Das Profil hat ein Alter unter 18: Zustimmung nicht möglich. */
  isMinor = false;

  readonly isAdult = signal(false);

  setAdult(checked: boolean): void {
    this.isAdult.set(checked);
  }

  accept(): void {
    if (this.isMinor || !this.store.grant(new Date(), this.isAdult())) return;
    void this.modals.dismiss(null, CONSENT_ROLE_CONFIRM);
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
