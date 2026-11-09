import { ChangeDetectionStrategy, Component, computed, inject } from '@angular/core';
import { DiaryStore } from '../core/state/diary.store';
import { ProfileStore } from '../core/state/profile.store';
import { toDateISO } from '../core/util/date';
import { DayTotals, lastDays, proteinStripStates, ProteinStripState } from '../diary/week-view/week-stats';

const STATE_TEXT: Record<ProteinStripState, string> = {
  met: 'Eiweißziel erreicht',
  partial: 'Eiweiß teilweise',
  open: 'Eiweiß offen',
  empty: 'nichts eingetragen',
};

interface StripDayView {
  readonly dateISO: string;
  readonly weekday: string;
  readonly state: ProteinStripState;
  readonly isToday: boolean;
  readonly ariaLabel: string;
}

function weekdayShort(dateISO: string): string {
  const [y, m, d] = dateISO.split('-').map(Number);
  return new Date(y, m - 1, d).toLocaleDateString('de-DE', { weekday: 'short' }).replace('.', '');
}

/** Wochenstreifen auf Heute: sieben Tage, je ein Punkt für das Eiweißziel (gleiche Schwelle wie die Wochenansicht). */
@Component({
  selector: 'app-week-strip',
  templateUrl: './week-strip.component.html',
  styleUrls: ['./week-strip.component.scss'],
  standalone: false,
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class WeekStripComponent {
  private readonly diary = inject(DiaryStore);
  private readonly profile = inject(ProfileStore);

  private readonly days = computed<DayTotals[]>(() => {
    this.diary.entries();
    return lastDays(toDateISO()).map((dateISO) => {
      const totals = this.diary.totalsForDate(dateISO);
      return { dateISO, kcal: Math.round(totals.kcal), proteinG: Math.round(totals.proteinG), logged: this.diary.entriesForDate(dateISO).length > 0 };
    });
  });

  readonly strip = computed<StripDayView[]>(() => {
    const target = this.profile.target();
    if (!target) return [];
    return proteinStripStates(this.days(), { kcal: target.kcal, proteinG: target.proteinG }, toDateISO()).map((d) => ({
      dateISO: d.dateISO,
      weekday: weekdayShort(d.dateISO),
      state: d.state,
      isToday: d.isToday,
      ariaLabel: `${d.isToday ? 'Heute' : weekdayShort(d.dateISO)}: ${STATE_TEXT[d.state]}`,
    }));
  });

  readonly metCount = computed(() => this.strip().filter((d) => d.state === 'met').length);
}
