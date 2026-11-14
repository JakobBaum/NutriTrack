import { ChangeDetectionStrategy, Component, inject } from '@angular/core';
import { ModalController } from '@ionic/angular/lazy';

/** Datenschutzerklärung als eigenes Sheet über dem Zustimmungsdialog; der Dialog darunter bleibt offen. */
@Component({
  selector: 'app-privacy-modal',
  standalone: false,
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <div class="sheet-grabber" aria-hidden="true"></div>
    <ion-header class="ion-no-border sheet-header">
      <div class="nt-sheet-header">
        <div class="nt-sheet-header__start"></div>
        <h2 class="nt-sheet-header__title" role="heading" aria-level="2">Datenschutzerklärung</h2>
        <div class="nt-sheet-header__end">
          <ion-button fill="clear" class="nt-sheet-close" data-testid="privacy-close" (click)="close()" aria-label="Schließen">
            <ion-icon slot="icon-only" name="close-outline" aria-hidden="true"></ion-icon>
          </ion-button>
        </div>
      </div>
    </ion-header>
    <ion-content class="sheet-content">
      <div class="nt-page settings-info" data-testid="privacy-modal">
        <app-legal-info section="datenschutz"></app-legal-info>
      </div>
    </ion-content>
  `,
})
export class PrivacyModalComponent {
  private readonly modals = inject(ModalController);

  close(): void {
    void this.modals.dismiss();
  }
}
