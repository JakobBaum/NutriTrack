import { ChangeDetectionStrategy, Component, computed, effect, inject, input, output, signal, untracked } from '@angular/core';
import { ActionSheetController, ToastController } from '@ionic/angular';
import { AmountUnit, DiaryEntry, MealType } from '../../core/models';
import { DiaryStore } from '../../core/state/diary.store';
import { FavoriteStore } from '../../core/state/favorite.store';
import { dismissKeyboard } from '../../core/keyboard/dismiss-keyboard';
import { StepDirection, amountChips, stepAmount, stepServings } from '../diary-edit';
import {
  AMOUNT_UNITS,
  buildLastAmountIndex,
  convertAmount,
  inputTextFor,
  lastAmountFromIndex,
  fromBaseAmount,
  mealLabel,
  toNumberOrNull,
} from '../diary-helpers';
import { confirmDiscardSheet, pickMealSheet } from '../diary-sheets';
import { showEntryToast } from '../entry-toast';
import { lightHaptic } from '../haptics';
import { ensureWritable } from '../write-guard';
import { EditState, EntryPatch, buildEditPatch, initialEditState } from './edit-entry-logic';

const EMPTY_STATE: EditState = { label: '', meal: 'breakfast', amount: null, unit: 'g', servings: null, mode: 'amount', baseFacts: null };

/** Eintrag samt geprüfter Änderung, z. B. für „Doppelt eintragen“ mit den bereits geänderten Werten. */
export interface EditedEntry {
  readonly entry: DiaryEntry;
  readonly patch: EntryPatch;
}

/**
 * „Eintrag bearbeiten“ als eigenes Sheet mit Signalen. Öffnet, sobald `entry` gesetzt ist;
 * `closed` meldet jedes Schließen, der Aufrufer setzt `entry` zurück.
 */
@Component({
  selector: 'app-edit-entry-sheet',
  templateUrl: './edit-entry-sheet.component.html',
  styleUrls: ['./edit-entry-sheet.component.scss'],
  standalone: false,
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class EditEntrySheetComponent {
  private readonly diary = inject(DiaryStore);
  private readonly favorites = inject(FavoriteStore);
  private readonly toastCtrl = inject(ToastController);
  private readonly sheetCtrl = inject(ActionSheetController);

  /** Der Eintrag, der bearbeitet wird; null = Sheet zu. */
  readonly entry = input<DiaryEntry | null>(null);
  readonly closed = output<void>();
  /** „Doppelt eintragen“ mit den aktuell eingegebenen (geprüften) Änderungen. */
  readonly duplicate = output<EditedEntry>();
  readonly remove = output<DiaryEntry>();

  readonly isOpen = computed(() => this.entry() !== null);
  readonly dismissKeyboard = dismissKeyboard;

  readonly state = signal<EditState>(EMPTY_STATE);
  readonly error = signal<string | null>(null);
  /** Roher Tipptext je Zahlenfeld (erhält z. B. "1," beim Tippen); Schritte und Chips löschen ihn. */
  private readonly rawTexts = signal<Readonly<Record<string, string>>>({});
  private readonly initial = signal('');

  readonly amountText = computed(() => inputTextFor(this.rawTexts()['amount'], this.state().amount));
  readonly servingsText = computed(() => inputTextFor(this.rawTexts()['servings'], this.state().servings));
  readonly mealName = computed(() => mealLabel(this.state().meal));
  readonly isDirty = computed(() => this.entry() !== null && this.snapshot() !== this.initial());
  readonly isFavorite = computed(() => {
    const e = this.entry();
    return !!e && this.favorites.isFavorite(e);
  });

  private readonly lastAmounts = computed(() => buildLastAmountIndex(this.diary.entries()));
  readonly chips = computed(() => {
    const { unit, label } = this.state();
    const last = lastAmountFromIndex(this.lastAmounts(), label, this.entry()?.id);
    return amountChips(unit, last == null ? null : fromBaseAmount(last, unit));
  });

  /** canDismiss des Sheets: Rückfrage nur bei geänderten Feldern. */
  readonly canDismiss = (): Promise<boolean> => this.confirmClose();

  constructor() {
    effect(() => {
      const entry = this.entry();
      if (entry) untracked(() => this.load(entry));
    });
  }

  private load(entry: DiaryEntry): void {
    this.state.set(initialEditState(entry));
    this.rawTexts.set({});
    this.error.set(null);
    this.initial.set(this.snapshot());
  }

  private snapshot(): string {
    const s = this.state();
    return JSON.stringify([s.label, s.meal, s.amount, s.unit, s.servings]);
  }

  private patchState(next: Partial<EditState>): void {
    this.state.update((s) => ({ ...s, ...next }));
    this.error.set(null);
  }

  private setRaw(key: string, text: string | null): void {
    this.rawTexts.update(({ [key]: _old, ...rest }) => (text === null ? rest : { ...rest, [key]: text }));
  }

  setLabel(value: unknown): void {
    this.patchState({ label: typeof value === 'string' ? value : '' });
  }

  setUnit(unit: unknown): void {
    const { unit: current, amount } = this.state();
    if (!AMOUNT_UNITS.includes(unit as AmountUnit) || unit === current) return;
    const next = unit as AmountUnit;
    this.setRaw('amount', null);
    this.patchState({ unit: next, amount: amount == null ? null : convertAmount(amount, current, next) });
  }

  /** Tippen: der Rohtext bleibt erhalten, Schritte und Chips setzen eine Zahl (Anzeige mit Komma). */
  setAmount(value: unknown): void {
    this.setRaw('amount', typeof value === 'string' ? value : null);
    this.patchState({ amount: toNumberOrNull(value) });
  }

  setServings(value: unknown): void {
    this.setRaw('servings', typeof value === 'string' ? value : null);
    this.patchState({ servings: toNumberOrNull(value) });
  }

  stepAmount(direction: StepDirection): void {
    const { amount, unit } = this.state();
    this.setAmount(stepAmount(amount, unit, direction));
  }

  stepServings(direction: StepDirection): void {
    this.setServings(stepServings(this.state().servings, direction));
  }

  async pickMeal(): Promise<void> {
    const meal: MealType | null = await pickMealSheet(this.sheetCtrl, this.state().meal);
    if (meal) this.patchState({ meal });
  }

  async requestClose(): Promise<void> {
    if (await this.confirmClose()) this.closed.emit();
  }

  private async confirmClose(): Promise<boolean> {
    return !this.isDirty() || confirmDiscardSheet(this.sheetCtrl);
  }

  save(): void {
    const entry = this.entry();
    if (!entry) return;
    const outcome = buildEditPatch(entry, this.state());
    if (outcome.patch === undefined) {
      this.error.set(outcome.error);
      return;
    }
    if (!ensureWritable(this.diary, this.toastCtrl)) return;
    this.diary.update(entry.id, outcome.patch);
    lightHaptic();
    this.closed.emit();
  }

  toggleFavorite(): void {
    const entry = this.entry();
    if (!entry || !ensureWritable(this.favorites, this.toastCtrl)) return;
    const added = this.favorites.toggle(entry);
    lightHaptic();
    void showEntryToast(this.toastCtrl, added ? `„${entry.label}“ als Favorit gemerkt` : `„${entry.label}“ aus den Favoriten entfernt`);
  }

  /** Doppelt eintragen mit den aktuell eingegebenen Werten (nicht mit dem unveränderten Original). */
  duplicateEntry(): void {
    const entry = this.entry();
    if (!entry) return;
    const outcome = buildEditPatch(entry, this.state());
    if (outcome.patch === undefined) {
      this.error.set(outcome.error);
      return;
    }
    this.closed.emit();
    this.duplicate.emit({ entry, patch: outcome.patch });
  }

  removeEntry(): void {
    const entry = this.entry();
    if (!entry) return;
    this.closed.emit();
    this.remove.emit(entry);
  }
}
