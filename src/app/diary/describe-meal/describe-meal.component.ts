import { ChangeDetectionStrategy, Component, OnDestroy, computed, inject, input, output, signal } from '@angular/core';
import { ToastController } from '@ionic/angular';
import { AiService } from '../../core/ai/ai.service';
import { AI_ERROR_MESSAGES } from '../../core/ai/ai-errors';
import { MAX_MEAL_TEXT_CHARS, MEAL_NOTHING_RECOGNIZED_MESSAGE, MealParseResult } from '../../core/ai/meal-parse';
import { MealType } from '../../core/models';
import { DiaryStore } from '../../core/state/diary.store';
import { MEAL_DEFS } from '../diary-helpers';
import { entryAddedMessage } from '../entry-message';
import { showEntryToast } from '../entry-toast';
import { ensureWritable } from '../write-guard';
import { lightHaptic } from '../haptics';
import {
  DESCRIBE_NOTE,
  MealRow,
  canLogRows,
  checkDescription,
  entriesFromRows,
  labelFromDescription,
  mealTotals,
  removeRow,
  rowTotals,
  rowsFromItems,
  withAmountText,
  withSteppedAmount,
} from './describe-meal-logic';

type Phase = 'idle' | 'loading' | 'results' | 'empty' | 'error';

const NOT_LIVE_HINT = 'Ohne KI-Verbindung geht das nicht. Trag das Essen stattdessen von Hand ein.';

/**
 * "Essen beschreiben": Freitext -> KI-Erkennung (geprüft) -> Bestätigungsliste -> Tagebuch.
 * Eigene Ansicht im Eintragen-Sheet (Kopf und Rahmen kommen vom Sheet). Geschrieben wird erst mit "Eintragen".
 */
@Component({
  selector: 'app-describe-meal',
  templateUrl: './describe-meal.component.html',
  styleUrls: ['./describe-meal.component.scss'],
  standalone: false,
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class DescribeMealComponent implements OnDestroy {
  private readonly ai = inject(AiService);
  private readonly diary = inject(DiaryStore);
  private readonly toastCtrl = inject(ToastController);

  readonly meal = input<MealType>('breakfast');
  /** ISO-Tag, auf den eingetragen wird. */
  readonly date = input.required<string>();
  readonly mealChange = output<MealType>();
  /** Eingetragen: das Sheet kann schließen. */
  readonly logged = output<void>();
  /** Weg zur manuellen Eingabe; gibt den eingetippten Text als Namensvorschlag mit. */
  readonly manual = output<string>();

  readonly maxChars = MAX_MEAL_TEXT_CHARS;
  readonly note = DESCRIBE_NOTE;
  readonly notLiveHint = NOT_LIVE_HINT;
  readonly nothingRecognized = MEAL_NOTHING_RECOGNIZED_MESSAGE;
  readonly mealOptions = MEAL_DEFS.map((m) => ({ value: m.type, label: m.label }));

  readonly text = signal('');
  readonly phase = signal<Phase>('idle');
  readonly errorText = signal<string | null>(null);
  readonly rows = signal<MealRow[]>([]);
  readonly droppedCount = signal(0);
  readonly isLive = this.ai.isLive();

  readonly textLength = computed(() => this.text().trim().length);
  readonly textState = computed(() => checkDescription(this.text()));
  readonly canRun = computed(() => this.isLive && this.textState() === 'ok' && this.phase() !== 'loading');
  readonly canLog = computed(() => canLogRows(this.rows()));
  readonly totals = computed(() => mealTotals(this.rows()));
  /** Text oder Ergebnisliste vorhanden: Schließen fragt dann "Verwerfen?". */
  readonly isDirty = computed(() => this.textLength() > 0 || this.rows().length > 0);

  /** Zähler der Anfragen: Nur die jüngste darf Ergebnis oder Fehler setzen. */
  private seq = 0;
  private isLogging = false;

  ngOnDestroy(): void {
    this.seq++;
  }

  setText(value: unknown): void {
    this.text.set(typeof value === 'string' ? value : '');
  }

  /** Erkennen; ein zweiter Tipp während der Anfrage löst keinen weiteren Aufruf aus. */
  async recognize(): Promise<void> {
    if (!this.canRun()) return;
    const token = ++this.seq;
    this.errorText.set(null);
    this.phase.set('loading');
    try {
      const result = await this.ai.parseMeal(this.text().trim());
      if (token === this.seq) this.applyResult(result);
    } catch (e: unknown) {
      if (token !== this.seq) return;
      this.errorText.set(e instanceof Error && e.message ? e.message : AI_ERROR_MESSAGES.generic);
      this.phase.set('error');
    }
  }

  /** Bricht die laufende Anfrage ab; eine spätere Antwort wird verworfen. */
  cancel(): void {
    this.seq++;
    this.phase.set('idle');
  }

  /** Zurück zum Text (Liste verwerfen, Text bleibt). */
  editText(): void {
    this.seq++;
    this.rows.set([]);
    this.phase.set('idle');
  }

  private applyResult(result: MealParseResult): void {
    this.droppedCount.set(result.droppedCount);
    this.rows.set(rowsFromItems(result.items));
    this.phase.set(result.items.length > 0 ? 'results' : 'empty');
  }

  setAmount(row: MealRow, text: string): void {
    this.replaceRow(withAmountText(row, text));
  }

  step(row: MealRow, direction: 1 | -1): void {
    this.replaceRow(withSteppedAmount(row, direction));
  }

  remove(row: MealRow): void {
    const rest = removeRow(this.rows(), row.id);
    this.rows.set(rest);
    // Letzte Zeile entfernt: zurück zum Text (nicht "nichts erkannt"; die Erkennung war ja erfolgreich).
    if (rest.length === 0) this.phase.set('idle');
  }

  private replaceRow(next: MealRow): void {
    this.rows.update((rows) => rows.map((r) => (r.id === next.id ? next : r)));
  }

  openManual(): void {
    this.manual.emit(labelFromDescription(this.text()));
  }

  totalsOf(row: MealRow): { kcal: number; proteinG: number } {
    return rowTotals(row);
  }

  /** Nach dem Eintragen ist nichts mehr ungesichert (kein "Verwerfen?" beim Schließen) und ein neuer Lauf ist möglich. */
  private resetAfterLog(): void {
    this.seq++;
    this.text.set('');
    this.rows.set([]);
    this.droppedCount.set(0);
    this.phase.set('idle');
    this.isLogging = false;
  }

  /** Schreibt je Zeile einen Eintrag; "Rückgängig" nimmt alle gemeinsam zurück. */
  log(): void {
    if (this.isLogging || !this.canLog() || !ensureWritable(this.diary, this.toastCtrl)) return;
    this.isLogging = true;
    const meal = this.meal();
    const added = entriesFromRows(this.rows(), this.date(), meal).map((entry) => this.diary.add(entry));
    lightHaptic();
    const message = entryAddedMessage(meal, mealTotals(this.rows()));
    this.resetAfterLog();
    this.logged.emit();
    void showEntryToast(this.toastCtrl, message, () => added.forEach((e) => this.diary.remove(e.id)));
  }
}
