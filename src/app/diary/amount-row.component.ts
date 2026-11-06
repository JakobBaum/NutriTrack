import { ChangeDetectionStrategy, Component, EventEmitter, Input, Output, ViewChild, inject } from '@angular/core';
import { ActionSheetController } from '@ionic/angular';
import { AmountUnit } from '../core/models';
import { AMOUNT_UNITS } from './diary-helpers';
import type { StepDirection } from './diary-edit';

/** Eingabefeld mit Einheiten-Menü. */
interface IonInputLike {
  setFocus(): Promise<void>;
  getInputElement(): Promise<HTMLInputElement>;
}

let nextId = 0;

/**
 * Eine Zeile für Mengen: [−] [Zahl + Einheit ▾] [+]. Ohne `unit` (Portionen)
 * zeigt sie statt des Menüs den festen `suffix`. Chips o. Ä. kommen per Content-Projection darunter.
 */
@Component({
  selector: 'app-amount-row',
  templateUrl: './amount-row.component.html',
  styleUrls: ['./amount-row.component.scss'],
  standalone: false,
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class AmountRowComponent {
  private readonly actionSheet = inject(ActionSheetController);

  @Input() label = 'Menge';
  @Input() text = '';
  @Input() placeholder = '';
  /** Gewählte Einheit; null = Portionen (kein Menü). */
  @Input() unit: AmountUnit | null = null;
  @Input() suffix = '';
  @Output() readonly textChange = new EventEmitter<string>();
  @Output() readonly unitChange = new EventEmitter<AmountUnit>();
  @Output() readonly stepped = new EventEmitter<StepDirection>();

  @ViewChild('field') private field?: IonInputLike;

  readonly labelId = `amount-label-${nextId++}`;

  onText(value: unknown): void {
    this.textChange.emit(String(value ?? ''));
  }

  selectAll(event: Event): void {
    const el = event.target as { getInputElement?: () => Promise<HTMLInputElement> } | null;
    void el?.getInputElement?.().then((input) => input.select());
  }

  /** Fokussiert das Feld und markiert den Inhalt, damit Tippen ihn ersetzt. */
  focus(): void {
    const field = this.field;
    if (!field) return;
    void field.setFocus().then(() => field.getInputElement()).then((el) => el.select());
  }

  async pickUnit(): Promise<void> {
    const sheet = await this.actionSheet.create({
      header: 'Einheit',
      buttons: [
        ...AMOUNT_UNITS.map((u) => ({
          text: u,
          role: u === this.unit ? 'selected' : undefined,
          handler: () => this.unitChange.emit(u),
        })),
        { text: 'Abbrechen', role: 'cancel' },
      ],
    });
    await sheet.present();
  }
}
