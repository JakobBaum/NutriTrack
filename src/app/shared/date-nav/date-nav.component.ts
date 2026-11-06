import { ChangeDetectionStrategy, Component, computed, input, output, signal } from '@angular/core';
import { addDaysISO, dayLabel, toDateISO } from '../../core/util/date';

const ISO_DAY = /^\d{4}-\d{2}-\d{2}/;

/** Nimmt den Wert eines ion-datetime (String oder Liste) und liefert einen ISO-Tag, höchstens `max`; sonst null. */
export function pickedDay(value: unknown, max: string): string | null {
  const raw = Array.isArray(value) ? value[0] : value;
  if (typeof raw !== 'string' || !ISO_DAY.test(raw)) return null;
  const day = raw.slice(0, 10);
  return day > max ? max : day;
}

/**
 * Tagesnavigation: [‹] [Datum ▾] [›]. Das Datum öffnet einen Kalender (ion-datetime,
 * deutsch, höchstens heute). `full` zeigt „Mittwoch, 6. November“ statt „Heute/Gestern“.
 */
@Component({
  selector: 'nt-date-nav',
  templateUrl: './date-nav.component.html',
  styleUrls: ['./date-nav.component.scss'],
  standalone: false,
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class NtDateNavComponent {
  readonly date = input.required<string>();
  readonly full = input(false);
  readonly dateChange = output<string>();

  protected readonly pickerOpen = signal(false);
  protected readonly maxDate = toDateISO();
  protected readonly isToday = computed(() => this.date() >= toDateISO());
  protected readonly label = computed(() =>
    this.full()
      ? new Intl.DateTimeFormat('de-AT', { weekday: 'long', day: 'numeric', month: 'long' }).format(new Date(`${this.date()}T12:00:00`))
      : dayLabel(this.date()),
  );

  protected shift(days: 1 | -1): void {
    this.dateChange.emit(addDaysISO(this.date(), days));
  }

  protected onPick(value: unknown): void {
    const day = pickedDay(value, toDateISO());
    this.pickerOpen.set(false);
    if (day && day !== this.date()) this.dateChange.emit(day);
  }
}
