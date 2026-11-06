import { ChangeDetectionStrategy, Component, computed, input, output } from '@angular/core';
import { formatNum } from '../num.pipe';
import { stepValue } from './stepper-math';

/**
 * Zähler mit −/+ (je 44 px) für kleine Werte. Leerer Wert (null) zeigt „–“;
 * das erste Tippen springt auf `start`. Anzeige mit Dezimalkomma.
 */
@Component({
  selector: 'nt-stepper',
  templateUrl: './stepper.component.html',
  styleUrls: ['./stepper.component.scss'],
  standalone: false,
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class NtStepperComponent {
  readonly value = input<number | null>(null);
  readonly min = input(0);
  readonly max = input(100);
  readonly step = input(1);
  readonly unit = input('');
  readonly label = input('');
  readonly decimals = input(0);
  /** Wert beim ersten Tippen auf einen leeren Stepper (Standard: min). */
  readonly start = input<number | null>(null);

  readonly valueChange = output<number>();

  protected readonly display = computed(() => formatNum(this.value(), this.decimals(), this.decimals()));
  protected readonly isEmpty = computed(() => this.value() === null);
  protected readonly canDecrease = computed(() => this.value() === null || (this.value() as number) > this.min());
  protected readonly canIncrease = computed(() => this.value() === null || (this.value() as number) < this.max());

  protected change(direction: 1 | -1): void {
    this.valueChange.emit(
      stepValue(this.value(), direction, {
        min: this.min(),
        max: this.max(),
        step: this.step(),
        start: this.start() ?? this.min(),
      }),
    );
  }
}
