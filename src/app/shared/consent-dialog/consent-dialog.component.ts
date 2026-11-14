import { ChangeDetectionStrategy, Component, inject, signal } from '@angular/core';
import { Router } from '@angular/router';
import { ModalController } from '@ionic/angular/lazy';
import { ConsentStore } from '../../core/consent/consent.store';
import { PRIVACY_INFO_URL } from '../../settings/info-link';

/** Rollen, mit denen der Dialog schließt. */
export const CONSENT_ROLE_CONFIRM = 'confirm';
export const CONSENT_ROLE_CANCEL = 'cancel';
export const CONSENT_ROLE_PRIVACY = 'privacy';

/** Dialog "KI- und Online-Funktionen": Einwilligung mit 18+-Bestätigung. Wird nur über den ConsentService geöffnet. */
@Component({
  selector: 'app-consent-dialog',
  templateUrl: './consent-dialog.component.html',
  styleUrls: ['./consent-dialog.component.scss'],
  standalone: false,
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class ConsentDialogComponent {
  private readonly modal = inject(ModalController);
  private readonly store = inject(ConsentStore);
  private readonly router = inject(Router);

  /** Das Profil hat ein Alter unter 18: Zustimmung nicht möglich. */
  isMinor = false;

  readonly isAdult = signal(false);

  setAdult(checked: boolean): void {
    this.isAdult.set(checked);
  }

  accept(): void {
    if (this.isMinor || !this.store.grant(new Date(), this.isAdult())) return;
    void this.modal.dismiss(null, CONSENT_ROLE_CONFIRM);
  }

  decline(): void {
    void this.modal.dismiss(null, CONSENT_ROLE_CANCEL);
  }

  async openPrivacy(): Promise<void> {
    await this.modal.dismiss(null, CONSENT_ROLE_PRIVACY);
    await this.router.navigateByUrl(PRIVACY_INFO_URL);
  }
}
