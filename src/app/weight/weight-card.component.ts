import { ChangeDetectionStrategy, Component, computed, inject, output, signal } from '@angular/core';
import { ToastController } from '@ionic/angular';
import { ProfileStore } from '../core/state/profile.store';
import { WeightStore } from '../core/state/weight.store';
import { dayLabel, toDateISO } from '../core/util/date';
import { driftSinceProfile, trendKgPerWeek } from '../core/weight/weight-math';
import { lightHaptic } from '../diary/haptics';
import { showEntryToast } from '../diary/entry-toast';
import { formatNum } from '../shared/num.pipe';
import { buildWeightChart } from './weight-chart';

const CHART_SIZE = { width: 320, height: 140, padX: 12, padY: 14 } as const;
/** So viele letzte Einträge zeigt die Liste unter dem Diagramm. */
const RECENT_COUNT = 5;

/** Kurzdatum "08.11." für Achse und Liste. */
function shortDate(dateISO: string): string {
  const [, m, d] = dateISO.split('-');
  return `${d}.${m}.`;
}

/** Trend als Text, z. B. "−0,4 kg pro Woche". */
export function trendText(trend: number | null): string | null {
  if (trend === null) return null;
  const sign = trend > 0 ? '+' : trend < 0 ? '−' : '±';
  return `${sign}${formatNum(Math.abs(trend), 1)} kg pro Woche`;
}

/**
 * Gewichtsverlauf im Profil: aktueller Wert, Trend (kg/Woche), Liniendiagramm
 * mit 7-Tage-Glättung, Erfassen per Sheet und der Hinweis "Ziel neu berechnen".
 */
@Component({
  selector: 'app-weight-card',
  templateUrl: './weight-card.component.html',
  styleUrls: ['./weight-card.component.scss'],
  standalone: false,
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class WeightCardComponent {
  private readonly weights = inject(WeightStore);
  private readonly profile = inject(ProfileStore);
  private readonly toastCtrl = inject(ToastController);

  /** Der Nutzer will das Ziel mit diesem Gewicht (kg) neu berechnen. */
  readonly recalculate = output<number>();

  readonly sheetOpen = signal(false);

  readonly latest = this.weights.latest;
  readonly chart = computed(() => buildWeightChart(this.weights.entries(), CHART_SIZE));
  readonly chartSize = CHART_SIZE;
  readonly trend = computed(() => trendText(trendKgPerWeek(this.weights.entries())));
  readonly firstDate = computed(() => shortDate(this.weights.entries()[0]?.dateISO ?? ''));
  readonly lastDate = computed(() => shortDate(this.latest()?.dateISO ?? ''));
  readonly latestLabel = computed(() => dayLabel(this.latest()?.dateISO ?? toDateISO()));
  readonly recent = computed(() =>
    [...this.weights.entries()].reverse().slice(0, RECENT_COUNT).map((e) => ({ ...e, label: dayLabel(e.dateISO), short: shortDate(e.dateISO) })),
  );

  /** Abweichung zum Profilgewicht (kg, mit Vorzeichen) ab 2 kg, sonst null. */
  readonly drift = computed(() => driftSinceProfile(this.profile.profile()?.weightKg ?? null, this.latest()?.kg ?? null));
  readonly driftText = computed(() => {
    const d = this.drift();
    const p = this.profile.profile();
    const l = this.latest();
    if (d === null || !p || !l) return null;
    return `Dein Gewicht hat sich seit deinem Profil um ${formatNum(Math.abs(d), 1)} kg ${d < 0 ? 'verringert' : 'erhöht'} (${formatNum(p.weightKg, 1)} auf ${formatNum(l.kg, 1)} kg). Berechne dein Ziel neu, damit es zu deinem Gewicht passt.`;
  });
  openSheet(): void {
    this.sheetOpen.set(true);
  }

  closeSheet(): void {
    this.sheetOpen.set(false);
  }

  remove(dateISO: string, kg: number): void {
    this.weights.remove(dateISO);
    lightHaptic();
    void showEntryToast(this.toastCtrl, 'Gewichtseintrag gelöscht.', () => {
      this.weights.set(dateISO, kg);
    });
  }

  recalc(): void {
    const kg = this.latest()?.kg;
    if (kg !== undefined) this.recalculate.emit(kg);
  }
}
