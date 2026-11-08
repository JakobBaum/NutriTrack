import { ChangeDetectionStrategy, Component, EventEmitter, Input, Output, ViewChild, inject } from '@angular/core';
import { ActionSheetController } from '@ionic/angular';
import { AMOUNT_UNITS } from '../../diary/diary-helpers';
import type { StepDirection } from '../../diary/diary-edit';

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
  @Input() unit: string | null = null;
  /** Auswählbare Einheiten (Standard: g, kg, ml, l). */
  @Input() units: readonly string[] = AMOUNT_UNITS;
  @Input() suffix = '';
  /** Ohne −/+ (z. B. in engen Listenzeilen). */
  @Input() showSteppers = true;
  /** Ohne sichtbares Label und ohne Außenabstand; das Label bleibt für Screenreader. */
  @Input() compact = false;
  @Output() readonly textChange = new EventEmitter<string>();
  @Output() readonly unitChange = new EventEmitter<string>();
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
        ...this.units.map((u) => ({
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
