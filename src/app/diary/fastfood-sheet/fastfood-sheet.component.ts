import {
  ChangeDetectionStrategy,
  Component,
  OnChanges,
  SimpleChanges,
  inject,
  input,
  output,
  signal,
} from '@angular/core';
import { ToastController } from '@ionic/angular';
import { FastFoodSuggestion } from '../../core/models';
import { AiService } from '../../core/ai/ai.service';
import { DiaryStore } from '../../core/state/diary.store';
import { formatNum } from '../../shared/num.pipe';
import { FASTFOOD_CHAINS, FastFoodForm, defaultKcalBudget } from '../fastfood-options';
import { mealForHour } from '../diary-helpers';
import { lightHaptic } from '../haptics';
import { showEntryToast } from '../entry-toast';

/**
 * Fastfood-Helfer als Sheet (einzige Implementierung, von Tagebuch und „Heute“ genutzt).
 * Öffnen über `isOpen`; Schließen meldet `closed`. Eingetragen wird am Tag `date`.
 */
@Component({
  selector: 'app-fastfood-sheet',
  templateUrl: './fastfood-sheet.component.html',
  styleUrls: ['./fastfood-sheet.component.scss'],
  standalone: false,
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class FastfoodSheetComponent implements OnChanges {
  private readonly ai = inject(AiService);
  private readonly diary = inject(DiaryStore);
  private readonly toastCtrl = inject(ToastController);

  readonly isOpen = input(false);
  /** ISO-Tag, auf den ein Vorschlag eingetragen wird. */
  readonly date = input.required<string>();
  /** Tagesziel in kcal (0 = kein Ziel). */
  readonly targetKcal = input(0);
  /** Verbleibende kcal des Tages (0, wenn Ziel erreicht oder überschritten). */
  readonly remainingKcal = input(0);
  readonly closed = output<void>();

  readonly error = signal<string | null>(null);
  readonly ffLoading = signal(false);
  readonly ffResults = signal<FastFoodSuggestion[]>([]);
  /** true nach der ersten Suche (Leerzustand). */
  readonly ffSearched = signal(false);
  ff: FastFoodForm = { restaurant: FASTFOOD_CHAINS[0], kcalBudget: null, moneyBudget: null, preference: 'viel Protein' };

  ffLive = (): boolean => this.ai.isLive();

  ngOnChanges(changes: SimpleChanges): void {
    if (changes['isOpen']?.currentValue === true) this.startSearch();
  }

  /** Setzt Ergebnisse zurück und schlägt das Kalorienbudget aus dem Resttag vor. */
  private startSearch(): void {
    this.ffResults.set([]);
    this.ffSearched.set(false);
    this.error.set(null);
    // Auch bei verbrauchtem Budget setzen (0 = nichts mehr übrig).
    if (this.targetKcal() > 0) {
      this.ff = { ...this.ff, kcalBudget: defaultKcalBudget(this.remainingKcal()) };
    }
  }

  closeFastfood(): void {
    this.closed.emit();
  }

  async runFastfood(): Promise<void> {
    if (!this.ffLive()) return;
    this.error.set(null);
    this.ffLoading.set(true);
    try {
      this.ffResults.set(
        await this.ai.suggestFastfood({
          restaurant: this.ff.restaurant.trim() || 'Fastfood',
          kcalBudget: this.ff.kcalBudget ?? defaultKcalBudget(this.remainingKcal()),
          moneyBudget: this.ff.moneyBudget ?? undefined,
          preference: this.ff.preference,
        }),
      );
      this.ffSearched.set(true);
    } catch (e: unknown) {
      this.error.set(
        e instanceof Error
          ? e.message
          : 'Die Vorschläge konnten nicht geladen werden — prüfe deine Verbindung und versuche es erneut.',
      );
    } finally {
      this.ffLoading.set(false);
    }
  }

  logFastfood(s: FastFoodSuggestion): void {
    const entry = this.diary.add({
      dateISO: this.date(),
      meal: mealForHour(new Date().getHours()),
      label: `${s.itemName} (${s.restaurant})`,
      facts: s.facts,
      isEstimate: true,
    });
    lightHaptic();
    this.closeFastfood();
    void showEntryToast(this.toastCtrl, `Eingetragen · ${formatNum(s.facts.kcal, 0)} kcal`, () => this.diary.remove(entry.id));
  }
}
