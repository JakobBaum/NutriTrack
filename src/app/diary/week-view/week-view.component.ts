import { ChangeDetectionStrategy, Component, computed, inject } from '@angular/core';
import { DiaryStore } from '../../core/state/diary.store';
import { ProfileStore } from '../../core/state/profile.store';
import { toDateISO } from '../../core/util/date';
import { formatNum } from '../../shared/num.pipe';
import { DayTotals, KCAL_CORRIDOR, PROTEIN_GOAL_SHARE, currentStreak, isDayInGoal, lastDays, weekSummary } from './week-stats';

const WEEKDAYS = ['So', 'Mo', 'Di', 'Mi', 'Do', 'Fr', 'Sa'] as const;
/** Platz über der Ziel-Linie, damit Überschreitungen sichtbar bleiben (Faktor am Ziel). */
const SCALE_HEADROOM = 1.3;

export interface BarView {
  readonly dateISO: string;
  readonly label: string;
  readonly isToday: boolean;
  readonly value: number;
  readonly logged: boolean;
  /** Balkenhöhe in Prozent der Skala. */
  readonly heightPct: number;
  readonly inGoal: boolean;
  /** Über dem Korridor: nur bei Kalorien als Warnung gefärbt. */
  readonly isOver: boolean;
}

export interface BarChartView {
  readonly bars: readonly BarView[];
  /** Höhe der Ziel-Linie in Prozent der Skala; null ohne Ziel. */
  readonly targetPct: number | null;
  readonly description: string;
}

const weekdayOf = (dateISO: string): string => {
  const [y, m, d] = dateISO.split('-').map(Number);
  return WEEKDAYS[new Date(y, m - 1, d).getDay()];
};

function buildChart(
  days: readonly DayTotals[],
  pick: (d: DayTotals) => number,
  target: number,
  unit: string,
  today: string,
  isOverTarget: (value: number) => boolean,
  inGoalOf: (d: DayTotals) => boolean,
): BarChartView {
  const scale = Math.max(target * SCALE_HEADROOM, ...days.map(pick), 1);
  const bars = days.map<BarView>((d) => ({
    dateISO: d.dateISO,
    label: weekdayOf(d.dateISO),
    isToday: d.dateISO === today,
    value: pick(d),
    logged: d.logged,
    heightPct: d.logged ? Math.max(2, Math.round((pick(d) / scale) * 100)) : 0,
    inGoal: inGoalOf(d),
    isOver: target > 0 && d.logged && isOverTarget(pick(d)),
  }));
  const description = bars
    .map((b) => `${b.label} ${b.logged ? `${formatNum(b.value, 0)} ${unit}` : 'nichts eingetragen'}`)
    .join(', ');
  return { bars, targetPct: target > 0 ? Math.round((target / scale) * 100) : null, description };
}

/**
 * Wochenansicht im Tagebuch: die letzten 7 Tage mit Mittelwerten (kcal, Eiweiß),
 * Tagen im Ziel, Serie und je einem Balkendiagramm mit Ziel-Linie.
 */
@Component({
  selector: 'app-week-view',
  templateUrl: './week-view.component.html',
  styleUrls: ['./week-view.component.scss'],
  standalone: false,
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class WeekViewComponent {
  private readonly diary = inject(DiaryStore);
  private readonly profile = inject(ProfileStore);

  readonly proteinSharePct = Math.round(PROTEIN_GOAL_SHARE * 100);
  readonly kcalMinPct = Math.round(KCAL_CORRIDOR.min * 100);
  readonly kcalMaxPct = Math.round(KCAL_CORRIDOR.max * 100);

  private readonly today = toDateISO();
  private readonly target = computed(() => {
    const t = this.profile.target();
    return { kcal: t?.kcal ?? 0, proteinG: t?.proteinG ?? 0 };
  });
  readonly hasTarget = computed(() => this.target().kcal > 0);

  private dayTotals(dateISO: string): DayTotals {
    const entries = this.diary.entriesForDate(dateISO);
    const totals = this.diary.totalsForDate(dateISO);
    return { dateISO, kcal: Math.round(totals.kcal), proteinG: Math.round(totals.proteinG), logged: entries.length > 0 };
  }

  private readonly days = computed<DayTotals[]>(() => {
    this.diary.entries(); // Abhängigkeit: bei jeder Änderung neu rechnen
    return lastDays(this.today).map((d) => this.dayTotals(d));
  });

  readonly summary = computed(() => weekSummary(this.days(), this.target()));
  readonly streak = computed(() => {
    this.diary.entries();
    const target = this.target();
    return currentStreak((d) => isDayInGoal(this.dayTotals(d), target), this.today);
  });

  readonly kcalChart = computed(() => {
    const t = this.target();
    return buildChart(this.days(), (d) => d.kcal, t.kcal, 'kcal', this.today, (v) => v > t.kcal * KCAL_CORRIDOR.max, (d) => isDayInGoal(d, t));
  });
  readonly proteinChart = computed(() => {
    const t = this.target();
    return buildChart(this.days(), (d) => d.proteinG, t.proteinG, 'g Eiweiß', this.today, () => false, (d) => isDayInGoal(d, t));
  });

  readonly daysWord = (n: number): string => (n === 1 ? 'Tag' : 'Tage');
}
