import {
  ChangeDetectionStrategy,
  Component,
  computed,
  ElementRef,
  OnChanges,
  SimpleChanges,
  inject,
  input,
  output,
  signal,
  ViewChild,
} from '@angular/core';
import { ToastController } from '@ionic/angular';
import { HEALTH_NOTES } from '../../core/messages/health-notes';
import { FastFoodRequest, FastFoodSuggestion } from '../../core/models';
import { AppSettingsStore } from '../../core/state/app-settings.store';
import { AiService } from '../../core/ai/ai.service';
import { DiaryStore } from '../../core/state/diary.store';
import { formatNum } from '../../shared/num.pipe';
import {
  FASTFOOD_CHAINS, FastFoodForm, MAX_FASTFOOD_ROUNDS, PREFERENCE_OPTIONS, defaultKcalBudget, excludeNames, isOverBudget, mergeSuggestions,
  preferenceSummary,
} from '../fastfood-options';
import { mealForHour } from '../diary-helpers';
import { lightHaptic } from '../haptics';
import { showEntryToast } from '../entry-toast';

const NO_MORE_MESSAGE = 'Keine weiteren Vorschläge gefunden. Ändere die Auswahl für neue Ideen.';
const LOAD_ERROR_MESSAGE = 'Die Vorschläge konnten nicht geladen werden — prüfe deine Verbindung und versuche es erneut.';

const errorText = (e: unknown): string => (e instanceof Error ? e.message : LOAD_ERROR_MESSAGE);

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
  private readonly settings = inject(AppSettingsStore);

  /** Anker über den Vorschlägen: Das Formular füllt auf dem Phone den Bildschirm, die Antwort liegt darunter. */
  @ViewChild('ffAnchor') private ffAnchor?: ElementRef<HTMLElement>;

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
  readonly ffNote = HEALTH_NOTES.fastfood;
  readonly ffResults = signal<FastFoodSuggestion[]>([]);
  /** true nach der ersten Suche (Leerzustand). */
  readonly ffSearched = signal(false);
  /** Läuft gerade "Weitere Vorschläge"? */
  readonly moreLoading = signal(false);
  readonly moreError = signal<string | null>(null);
  readonly moreNote = signal<string | null>(null);
  /** Anzahl der bisher geholten Zusatzrunden. */
  private readonly rounds = signal(0);
  readonly canLoadMore = computed(() => this.ffSearched() && this.ffResults().length > 0 && this.rounds() < MAX_FASTFOOD_ROUNDS);
  readonly roundsExhausted = computed(() => this.ffSearched() && this.ffResults().length > 0 && this.rounds() >= MAX_FASTFOOD_ROUNDS);
  readonly maxRounds = MAX_FASTFOOD_ROUNDS;
  /** Zähler der Anfragen: Nur die neueste darf Ergebnisse oder Ladezustand setzen. */
  private requestSeq = 0;
  ff: FastFoodForm = {
    restaurant: FASTFOOD_CHAINS[0], kcalBudget: null, moneyBudget: null, preferences: [PREFERENCE_OPTIONS[0].value],
    country: this.settings.fastfoodCountry(),
  };

  ffLive = (): boolean => this.ai.isLive();

  ngOnChanges(changes: SimpleChanges): void {
    if (changes['isOpen']?.currentValue === true) this.startSearch();
  }

  /** Setzt Ergebnisse zurück und schlägt das Kalorienbudget aus dem Resttag vor. */
  private startSearch(): void {
    this.resetResults();
    // Auch bei verbrauchtem Budget setzen (0 = nichts mehr übrig).
    const kcalBudget = this.targetKcal() > 0 ? defaultKcalBudget(this.remainingKcal()) : this.ff.kcalBudget;
    this.ff = { ...this.ff, kcalBudget, country: this.settings.fastfoodCountry() };
  }

  /** Leert die Liste und verwirft alle noch laufenden Anfragen. */
  private resetResults(): void {
    this.requestSeq++;
    this.ffResults.set([]);
    this.ffSearched.set(false);
    this.rounds.set(0);
    this.error.set(null);
    this.moreError.set(null);
    this.moreNote.set(null);
    this.ffLoading.set(false);
    this.moreLoading.set(false);
  }

  closeFastfood(): void {
    this.requestSeq++;
    this.ffLoading.set(false);
    this.moreLoading.set(false);
    this.closed.emit();
  }

  /** Formular geändert: Land merken, Liste beginnt neu. */
  onFormChange(next: FastFoodForm): void {
    if (next.country !== this.ff.country) this.settings.setFastfoodCountry(next.country);
    this.ff = next;
    this.resetResults();
  }

  runFastfood(): Promise<void> {
    return this.fetchSuggestions(false);
  }

  moreFastfood(): Promise<void> {
    return this.canLoadMore() ? this.fetchSuggestions(true) : Promise.resolve();
  }

  overBudget(s: FastFoodSuggestion): boolean {
    return isOverBudget(s, this.ff.kcalBudget ?? defaultKcalBudget(this.remainingKcal()));
  }

  private buildRequest(exclude: string[]): FastFoodRequest {
    return {
      restaurant: this.ff.restaurant.trim() || 'Fastfood',
      kcalBudget: this.ff.kcalBudget ?? defaultKcalBudget(this.remainingKcal()),
      moneyBudget: this.ff.moneyBudget ?? undefined,
      // Älterer Worker kennt nur "preference" (Text, max. 60 Zeichen): Kurzfassung der Kriterien.
      preference: preferenceSummary(this.ff.preferences),
      preferences: this.ff.preferences,
      country: this.ff.country,
      exclude,
    };
  }

  /** Holt Vorschläge; eine verspätete Antwort (neuere Anfrage, Schließen, Formularänderung) wird verworfen. */
  private async fetchSuggestions(append: boolean): Promise<void> {
    if (!this.ffLive()) return;
    this.error.set(null);
    this.moreError.set(null);
    this.moreNote.set(null);
    const token = ++this.requestSeq;
    this.ffLoading.set(!append);
    this.moreLoading.set(append);
    const shown = append ? this.ffResults() : [];
    try {
      const found = await this.ai.suggestFastfood(this.buildRequest(excludeNames(shown)));
      if (token !== this.requestSeq) return;
      this.applyResults(shown, found, append);
    } catch (e: unknown) {
      if (token !== this.requestSeq) return;
      (append ? this.moreError : this.error).set(errorText(e));
    } finally {
      if (token === this.requestSeq) {
        this.ffLoading.set(false);
        this.moreLoading.set(false);
      }
    }
  }

  private applyResults(shown: FastFoodSuggestion[], found: FastFoodSuggestion[], append: boolean): void {
    const merged = mergeSuggestions(shown, found);
    this.ffResults.set(merged);
    this.ffSearched.set(true);
    if (!append) {
      this.rounds.set(0);
      setTimeout(() => this.ffAnchor?.nativeElement.scrollIntoView({ block: 'start', behavior: 'smooth' }));
      return;
    }
    this.rounds.update((n) => n + 1);
    if (merged.length === shown.length) this.moreNote.set(NO_MORE_MESSAGE);
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
