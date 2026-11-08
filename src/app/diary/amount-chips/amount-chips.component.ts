import { ChangeDetectionStrategy, Component, input, output } from '@angular/core';
import { AmountUnit } from '../../core/models';
import { AmountChip } from '../diary-edit';
import { formatChipAmount } from '../diary-helpers';

/** Schnellwahl-Chips einer Mengenzeile; die Auswahl meldet der Wert über `pick`. */
@Component({
  selector: 'app-amount-chips',
  template: `
    <div class="quick-amounts" role="group" aria-label="Schnellwahl Menge">
      @for (chip of chips(); track chip.value) {
        <button type="button" class="nt-pill nt-pill--secondary quick-chip" [class.quick-chip--last]="chip.isLast" (click)="pick.emit(chip.value)" [attr.aria-label]="(chip.isLast ? 'Menge wie zuletzt: ' : 'Menge ') + chipText(chip.value, unit()) + ' ' + unit()">
          {{ chipText(chip.value, unit()) }}
          @if (chip.isLast) { <small>zuletzt</small> }
        </button>
      }
    </div>
  `,
  styleUrls: ['./amount-chips.component.scss'],
  standalone: false,
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class AmountChipsComponent {
  readonly chips = input<AmountChip[]>([]);
  readonly unit = input<AmountUnit>('g');
  readonly pick = output<number>();
  readonly chipText = formatChipAmount;
}
