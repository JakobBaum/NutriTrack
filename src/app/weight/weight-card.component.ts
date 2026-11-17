import { ChangeDetectionStrategy, Component, computed, inject, output, signal } from '@angular/core';
import { ToastController } from '@ionic/angular';
import { ProfileStore } from '../core/state/profile.store';
import { WRITE_BLOCKED_MESSAGE } from '../core/storage/storage-messages';
import { WeightStore } from '../core/state/weight.store';
import { dayLabel } from '../core/util/date';
import { injectToday } from '../shared/date-nav/use-today';
import { driftSinceProfile, shouldShowDriftHint, trendKgPerWeek } from '../core/weight/weight-math';
import { lightHaptic } from '../diary/haptics';
import { showEntryToast } from '../diary/entry-toast';
import { ensureWritable } from '../diary/write-guard';
import { formatNum } from '../shared/num.pipe';
import { buildWeightChart } from './weight-chart';
import { axisDateLabels, shortDate, trendText } from './weight-labels';

const CHART_SIZE = { width: 320, height: 140, padX: 12, padY: 14 } as const;
/** So viele letzte Einträge zeigt die Liste unter dem Diagramm. */
const RECENT_COUNT = 5;

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
  /** Heutiger Tag; "Heute/Gestern" rechnen nach Mitternacht neu. */
  private readonly today = injectToday();

  /** Der Nutzer will das Ziel mit diesem Gewicht (kg) neu berechnen. */
  readonly recalculate = output<number>();

  readonly sheetOpen = signal(false);

  readonly latest = this.weights.latest;
  readonly chart = computed(() => buildWeightChart(this.weights.entries(), CHART_SIZE));
  readonly chartSize = CHART_SIZE;
  readonly trend = computed(() => trendText(trendKgPerWeek(this.weights.entries())));
  /** Anzahl aller Messwerte im Diagramm (für den Screenreader-Namen). */
  readonly entryCount = computed(() => this.weights.entries().length);
  private readonly axisDates = computed(() => axisDateLabels(this.weights.entries()[0]?.dateISO ?? '', this.latest()?.dateISO ?? ''));
  readonly firstDate = computed(() => this.axisDates()[0]);
  readonly lastDate = computed(() => this.axisDates()[1]);
  readonly latestLabel = computed(() => dayLabel(this.latest()?.dateISO ?? this.today(), this.today()));
  readonly recent = computed(() =>
    [...this.weights.entries()].reverse().slice(0, RECENT_COUNT).map((e) => ({ ...e, label: dayLabel(e.dateISO, this.today()), short: shortDate(e.dateISO) })),
  );

  /** Abweichung zum Profilgewicht (kg, mit Vorzeichen) ab 2 kg, sonst null. */
  readonly drift = computed(() => driftSinceProfile(this.profile.profile()?.weightKg ?? null, this.latest()?.kg ?? null));
  readonly driftText = computed(() => {
    const d = this.drift();
    const p = this.profile.profile();
    const l = this.latest();
    if (d === null || !p || !l) return null;
    if (!shouldShowDriftHint(p.weightKg, l.kg, this.weights.driftHintDismissedAtKg())) return null;
    return `Dein Gewicht hat sich seit deinem Profil um ${formatNum(Math.abs(d), 1)} kg ${d < 0 ? 'verringert' : 'erhöht'} (${formatNum(p.weightKg, 1)} auf ${formatNum(l.kg, 1)} kg). Berechne dein Ziel neu, wenn es dazu passen soll. Es wird nichts automatisch geändert.`;
  });
  openSheet(): void {
    this.sheetOpen.set(true);
  }

  closeSheet(): void {
    this.sheetOpen.set(false);
  }

  remove(dateISO: string, kg: number): void {
    if (this.weights.isReadOnly()) {
      void showEntryToast(this.toastCtrl, WRITE_BLOCKED_MESSAGE);
      return;
    }
    if (!this.weights.remove(dateISO)) {
      void showEntryToast(this.toastCtrl, WRITE_BLOCKED_MESSAGE);
      return;
    }
    lightHaptic();
    void showEntryToast(this.toastCtrl, 'Gewichtseintrag gelöscht.', () => this.undoRemove(dateISO, kg));
  }

  /** Rückgängig: prüft die Schreibsperre erneut und meldet ein Scheitern statt stillschweigend nichts zu tun. */
  private undoRemove(dateISO: string, kg: number): void {
    if (!ensureWritable(this.weights, this.toastCtrl)) return;
    if (!this.weights.set(dateISO, kg)) void showEntryToast(this.toastCtrl, WRITE_BLOCKED_MESSAGE);
  }

  /** Öffnet das Profil mit dem neuen Gewicht. Der Hinweis bleibt, bis das Profil gespeichert ist (dann passt das Gewicht wieder). */
  recalc(): void {
    const kg = this.latest()?.kg;
    if (kg === undefined) return;
    this.recalculate.emit(kg);
  }

  dismissHint(): void {
    const kg = this.latest()?.kg;
    if (kg !== undefined) this.weights.dismissDriftHint(kg);
  }
}
