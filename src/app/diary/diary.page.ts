import {
  ChangeDetectionStrategy,
  Component,
  computed,
  effect,
  inject,
  signal,
  untracked,
} from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { ActivatedRoute, ParamMap, Router } from '@angular/router';
import { AppResumeService } from '../core/app-resume/app-resume.service';
import { ActionSheetController, AlertController, ToastController } from '@ionic/angular';
import { AmountUnit, DiaryEntry, MealType, NutritionFacts } from '../core/models';
import { AiService } from '../core/ai/ai.service';
import { CopySource, DiaryStore } from '../core/state/diary.store';
import { ProfileStore } from '../core/state/profile.store';
import { FavoriteStore } from '../core/state/favorite.store';
import { dayLabel, rollDate, toDateISO } from '../core/util/date';
import { formatNum } from '../shared/num.pipe';
import { MEAL_DEFS, mealForHour, mealLabel, isIsoDate, isMealType, isValidAmount, toBaseAmount, toNumberOrNull, inputTextFor, AMOUNT_UNITS, fromBaseAmount, convertAmount, lastAmountForLabel, editBaseFor } from './diary-helpers';
import { confirmDiscardSheet, pickMealSheet } from './diary-sheets';
import { lightHaptic } from './haptics';
import { showEntryToast } from './entry-toast';
import { clearRawTexts } from './raw-texts';
import { EditMode, StepDirection, amountChips, editModeFor, entryToInput, stepAmount, stepServings, withServings } from './diary-edit';
import { copyFromButtonText, copyFromText, copySourceOptionText, entriesKcal, entryCountText } from './diary-copy';

interface MealGroup {
  type: MealType;
  label: string;
  icon: string;
  entries: DiaryEntry[];
  kcal: number;
  /** Letzter früherer Tag mit Einträgen dieser Mahlzeit; nur gesetzt, wenn die Mahlzeit leer ist. */
  copySource: CopySource | null;
}


interface EditForm {
  label: string;
  meal: MealType;
  amountG: number | null;
}

/** rawTexts-Schlüssel des Bearbeiten-Dialogs. */
const EDIT_FORM_TEXT_KEYS: readonly string[] = ['editAmount', 'editServings'];
const SCROLL_TO_MEAL_DELAY_MS = 150;

/**
 * Tagebuch: Einträge je Mahlzeit, Bearbeiten/Löschen/Kopieren. Das Eintragen-Sheet
 * und der Fastfood-Helfer sind eigene Komponenten (`diary/add-entry-sheet`,
 * `diary/fastfood-sheet`), die auch „Heute“ nutzt.
 */
@Component({
  selector: 'app-diary',
  templateUrl: './diary.page.html',
  styleUrls: ['./diary.page.scss'],
  standalone: false,
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class DiaryPage {
  private readonly diary = inject(DiaryStore);
  private readonly profileStore = inject(ProfileStore);
  private readonly favorites = inject(FavoriteStore);
  private readonly ai = inject(AiService);
  private readonly route = inject(ActivatedRoute);
  private readonly router = inject(Router);
  private readonly resume = inject(AppResumeService);
  private readonly toastCtrl = inject(ToastController);
  private readonly alertCtrl = inject(AlertController);
  private readonly sheetCtrl = inject(ActionSheetController);

  /** KI-Schätzungen kennzeichnen (nur mit aktiver KI sichtbar). */
  ffLive = (): boolean => this.ai.isLive();

  /** Roher Tipptext je Zahlenfeld des Bearbeiten-Dialogs. */
  private readonly rawTexts: Record<string, string> = {};

  /** Tagebuch zeigt entweder einen Tag oder die letzten 7 Tage. */
  readonly view = signal<'day' | 'week'>('day');

  setView(value: unknown): void {
    this.view.set(value === 'week' ? 'week' : 'day');
  }

  readonly selectedDate = signal(toDateISO());
  /** Der Tag, den die Seite zuletzt als "heute" kannte (für den Tageswechsel). */
  private readonly today = signal(toDateISO());
  readonly dateLabel = computed(() => dayLabel(this.selectedDate()));
  readonly isToday = computed(() => this.selectedDate() === this.today());

  readonly totalKcal = computed(() =>
    Math.round(this.diary.totalsForDate(this.selectedDate()).kcal),
  );
  readonly targetKcal = computed(() => this.profileStore.target()?.kcal ?? 0);
  /** Verbleibende kcal des gewählten Tages (0, wenn das Ziel erreicht oder überschritten ist). */
  readonly remainingKcal = computed(() => Math.max(0, this.targetKcal() - this.totalKcal()));
  readonly overKcal = computed(() =>
    this.targetKcal() > 0 ? Math.max(0, this.totalKcal() - this.targetKcal()) : 0,
  );

  readonly groups = computed<MealGroup[]>(() => {
    const date = this.selectedDate();
    return MEAL_DEFS.map((d) => {
      const entries = this.diary.entriesForMeal(date, d.type);
      const kcal = entries.reduce((s, e) => s + (e.facts.kcal || 0), 0);
      const copySource = entries.length === 0 ? this.diary.findCopySource(date, d.type) : null;
      return { ...d, entries, kcal: Math.round(kcal), copySource };
    });
  });

  /** Frühere Tage (max. 7 zurück) mit Einträgen, für „Tag kopieren“. */
  readonly daySources = computed(() => this.diary.copySources(this.selectedDate()));

  // --- Eintragen-Sheet und Fastfood-Helfer (eigene Komponenten) ---
  readonly addOpen = signal(false);
  readonly addMeal = signal<MealType>('breakfast');
  readonly ffOpen = signal(false);

  /** Formatierung der Mengen in der Tagesliste. */

  // --- Edit-Modal ---
  readonly editOpen = signal(false);
  private editEntry: DiaryEntry | null = null;
  editForm: EditForm = { label: '', meal: 'breakfast', amountG: null };
  /** Einheit im Bearbeiten-Dialog; editForm.amountG zeigt den Wert in dieser Einheit. */
  editUnit: AmountUnit = 'g';
  editBaseFacts: NutritionFacts | null = null;
  editError: string | null = null;
  /** Welche Mengenzeile der Bearbeiten-Dialog zeigt (Menge, Portionen, optionale Menge). */
  editMode: EditMode = 'amount';
  editServings: number | null = null;
  /** Stand der Felder beim Öffnen; Abweichung = „Verwerfen?“ beim Schließen. */
  private editInitial = '';

  readonly mealLabelOf = mealLabel;

  constructor() {
    effect(() => {
      if (this.resume.resumeCount() > 0) untracked(() => this.refreshToday());
    });
    this.route.queryParamMap
      .pipe(takeUntilDestroyed())
      .subscribe((params) => this.handleQuery(params));
  }

  /** Mahlzeit, die zur aktuellen Uhrzeit passt (Vorgabe fürs Eintragen). */
  currentMeal(): MealType {
    return mealForHour(new Date().getHours());
  }

  /**
   * Liest `?add=<meal>` (öffnet das Eintragen-Sheet), `?fastfood=1` (öffnet den
   * Fastfood-Helfer) und `?date=` einmalig und entfernt sie danach aus der URL.
   */
  private handleQuery(params: ParamMap): void {
    const add = params.get('add');
    const wantsFastfood = params.get('fastfood') === '1';
    const meal = params.get('meal');
    const date = params.get('date');
    if (isIsoDate(date)) this.selectedDate.set(date);
    if (!add && !wantsFastfood && !meal && !date) return;

    if (add) {
      if (!isIsoDate(date)) this.selectedDate.set(toDateISO());
      this.openAdd(isMealType(add) ? add : this.currentMeal());
    }
    if (wantsFastfood) this.openFastfood();
    if (isMealType(meal)) {
      setTimeout(() => this.scrollToMeal(meal), SCROLL_TO_MEAL_DELAY_MS);
    }

    void this.router.navigate([], {
      relativeTo: this.route,
      queryParams: { add: null, fastfood: null, date: null, meal: null },
      queryParamsHandling: 'merge',
      replaceUrl: true,
    });
  }

  /** Scrollt zur Mahlzeit-Gruppe (Deep-Link ?meal=lunch). */
  private scrollToMeal(meal: MealType): void {
    document.getElementById('meal-' + meal)?.scrollIntoView({ behavior: 'smooth', block: 'start' });
  }

  /** Beim Betreten der Seite und beim Zurückkehren in die App: nach Mitternacht auf den neuen Tag springen. */
  ionViewWillEnter(): void {
    this.refreshToday();
  }

  private refreshToday(): void {
    const next = rollDate(this.selectedDate(), this.today(), toDateISO());
    this.today.set(next.today);
    this.selectedDate.set(next.selected);
  }

  setDate(dateISO: string): void {
    this.selectedDate.set(dateISO);
  }

  /** Öffnet das Eintragen-Sheet für eine Mahlzeit. */
  openAdd(meal: MealType = this.currentMeal()): void {
    this.addMeal.set(meal);
    this.addOpen.set(true);
  }

  openFastfood(): void {
    this.ffOpen.set(true);
  }

  // --- Eintrag bearbeiten / löschen ---
  get editEntryUnit(): AmountUnit {
    return this.editUnit;
  }

  /** Bearbeiten-Dialog: Einheit wechseln, gezeigten Wert umrechnen. */
  setEditUnit(unit: unknown): void {
    if (!AMOUNT_UNITS.includes(unit as AmountUnit) || unit === this.editUnit) return;
    const next = unit as AmountUnit;
    const v = this.editForm.amountG;
    this.editForm = { ...this.editForm, amountG: v == null ? null : convertAmount(v, this.editUnit, next) };
    this.editUnit = next;
  }

  /** Anzeigetext eines Zahlenfelds im Bearbeiten-Dialog (Dezimalkomma, Tipptext bleibt erhalten). */
  numText(key: string, value: number | null): string {
    return inputTextFor(this.rawTexts[key], value);
  }

  setEditAmount(value: unknown): void {
    this.rawTexts['editAmount'] = String(value ?? '');
    this.editForm = { ...this.editForm, amountG: toNumberOrNull(value) };
  }

  stepEditAmount(direction: StepDirection): void {
    delete this.rawTexts['editAmount'];
    this.setEditAmount(stepAmount(this.editForm.amountG, this.editUnit, direction));
  }

  stepEditServings(direction: StepDirection): void {
    delete this.rawTexts['editServings'];
    this.setEditServings(stepServings(this.editServings, direction));
  }

  setEditServings(value: unknown): void {
    if (typeof value === 'string') this.rawTexts['editServings'] = value;
    this.editServings = toNumberOrNull(value);
  }

  /**
   * Letzte geloggte Menge (in aktueller Einheit) für das gewählte Lebensmittel, sonst null.
   * `excludeId`: der gerade bearbeitete Eintrag zählt nicht als „zuletzt“.
   */
  lastAmountFor(label: string, unit: AmountUnit, excludeId?: string | null): number | null {
    const amount = lastAmountForLabel(this.diary.entries(), label, excludeId);
    return amount == null ? null : fromBaseAmount(amount, unit);
  }

  /** ID des Eintrags im Bearbeiten-Dialog (für „wie zuletzt“). */
  get editEntryId(): string | null {
    return this.editEntry?.id ?? null;
  }

  get editChips() {
    return amountChips(this.editUnit, this.lastAmountFor(this.editForm.label, this.editUnit, this.editEntryId));
  }

  pickEditAmount(value: number): void {
    delete this.rawTexts['editAmount'];
    this.setEditAmount(value);
  }

  openEdit(entry: DiaryEntry): void {
    this.editEntry = entry;
    clearRawTexts(this.rawTexts, EDIT_FORM_TEXT_KEYS);
    this.editUnit = entry.unit ?? 'g';
    // Manuelle Einträge mit Menge bekommen eine abgeleitete Basis, damit die Menge änderbar ist.
    this.editBaseFacts = editBaseFor(entry);
    this.editMode = editModeFor(entry, this.editBaseFacts);
    this.editServings = this.editMode === 'portion' ? (entry.servings ?? 1) : null;
    this.editForm = {
      label: entry.label,
      meal: entry.meal,
      amountG: entry.amountG == null ? null : fromBaseAmount(entry.amountG, this.editUnit),
    };
    this.editError = null;
    this.editInitial = this.editSnapshot();
    this.editOpen.set(true);
  }

  closeEdit(): void {
    this.editEntry = null;
    this.editOpen.set(false);
  }

  private editSnapshot(): string {
    const f = this.editForm;
    return JSON.stringify([f.label, f.meal, f.amountG, this.editUnit, this.editServings]);
  }

  /** canDismiss des Bearbeiten-Sheets: Rückfrage nur bei geänderten Feldern. */
  readonly canDismissEdit = (): Promise<boolean> => this.confirmEditClose();

  async requestCloseEdit(): Promise<void> {
    if (await this.confirmEditClose()) this.closeEdit();
  }

  private async confirmEditClose(): Promise<boolean> {
    const isDirty = !!this.editEntry && this.editSnapshot() !== this.editInitial;
    return !isDirty || confirmDiscardSheet(this.sheetCtrl);
  }

  /** Mahlzeit im Bearbeiten-Sheet per Action-Sheet wählen. */
  async pickEditMeal(): Promise<void> {
    const meal = await pickMealSheet(this.sheetCtrl, this.editForm.meal);
    if (meal) this.editForm = { ...this.editForm, meal };
  }

  saveEdit(): void {
    if (!this.editEntry) return;
    if (this.editMode === 'portion') {
      this.savePortionEdit(this.editEntry);
      return;
    }
    const editBase = this.editForm.amountG == null ? null : toBaseAmount(this.editForm.amountG, this.editUnit);
    if (this.editBaseFacts && !isValidAmount(editBase)) {
      this.editError = 'Die Menge fehlt — gib eine Menge größer als 0 ein.';
      return;
    }
    if (this.editMode === 'optional' && editBase != null && !isValidAmount(editBase)) {
      this.editError = 'Die Menge muss größer als 0 sein — oder lass das Feld leer.';
      return;
    }
    const patch: Parameters<typeof this.diary.update>[1] = {
      label: this.editForm.label,
      meal: this.editForm.meal,
    };
    if (this.editBaseFacts && isValidAmount(editBase)) {
      patch.amountG = editBase;
      patch.unit = this.editUnit;
      // Abgeleitete Basis nur bei geänderter Menge übernehmen (sonst keine Rundungsdrift).
      const isDerivedBase = !this.editEntry.baseFacts;
      if (isDerivedBase && editBase !== this.editEntry.amountG) patch.baseFacts = this.editBaseFacts;
    }
    if (this.editMode === 'optional') {
      // Nur Anzeige-Menge: ohne Bezugswerte bleiben die Nährwerte unverändert; leeres Feld entfernt die Menge.
      if (isValidAmount(editBase)) {
        patch.amountG = editBase;
        patch.unit = this.editUnit;
      } else {
        patch.clearAmount = true;
      }
    }
    this.diary.update(this.editEntry.id, patch);
    lightHaptic();
    this.closeEdit();
  }

  /** Portionen ändern: Nährwerte neu skaliert, Eintrag bleibt (id, createdAt, Reihenfolge). */
  private savePortionEdit(entry: DiaryEntry): void {
    if (!isValidAmount(this.editServings)) {
      this.editError = 'Die Portionen fehlen — gib eine Zahl größer als 0 ein.';
      return;
    }
    const next = withServings(entry, this.editServings);
    this.diary.update(entry.id, {
      label: this.editForm.label,
      meal: this.editForm.meal,
      servings: next.servings,
      facts: next.facts,
    });
    lightHaptic();
    this.closeEdit();
  }

  /** Der Eintrag im Bearbeiten-Dialog ist als Favorit gemerkt (gleicher Name und gleiche Marke). */
  isEditFavorite(): boolean {
    return !!this.editEntry && this.favorites.isFavorite(this.editEntry);
  }

  toggleEditFavorite(): void {
    const entry = this.editEntry;
    if (!entry) return;
    const added = this.favorites.toggle(entry);
    lightHaptic();
    this.showToast(added ? `„${entry.label}“ als Favorit gemerkt` : `„${entry.label}“ aus den Favoriten entfernt`);
  }

  deleteFromEdit(): void {
    const entry = this.editEntry;
    this.closeEdit();
    if (entry) this.remove(entry);
  }

  /** Löscht einen Eintrag; „Rückgängig“ legt ihn (am Ende der Mahlzeit) neu an. */
  remove(entry: DiaryEntry): void {
    lightHaptic();
    const index = this.diary.indexOf(entry.id);
    this.diary.remove(entry.id);
    // Rückgängig stellt den Eintrag mit alter Id und an alter Position wieder her.
    this.showToast(`„${entry.label}“ gelöscht`, () => {
      this.diary.restore(entry, index);
    });
  }

  /** Doppelt eintragen (Wisch-Aktion): Kopie am Ende der Mahlzeit, mit „Rückgängig“. */
  duplicate(entry: DiaryEntry): void {
    const copy = this.diary.add(entryToInput(entry));
    lightHaptic();
    this.showToast(`„${entry.label}“ doppelt eingetragen`, () => this.diary.remove(copy.id));
  }

  // --- Wie gestern / Tag kopieren ---
  readonly copyFromButtonText = copyFromButtonText;
  /** Sperrt „Tag kopieren“ gegen Doppelklick, solange der Dialog offen ist. */
  private copyBusy = false;

  /** Übernimmt eine leere Mahlzeit vom letzten Tag, an dem sie Einträge hatte. */
  copyMeal(group: MealGroup): void {
    if (!group.copySource || this.copyBusy) return;
    const copies = this.diary.copyEntries(group.copySource.entries, this.selectedDate());
    this.confirmCopy(copies, `${group.label} ${copyFromText(group.copySource.dateISO)}`);
  }

  /** Fragt den Quelltag ab (letzte 7 Tage) und kopiert ihn nach Bestätigung in den gezeigten Tag. */
  async copyDay(): Promise<void> {
    const sources = this.daySources();
    if (sources.length === 0 || this.copyBusy) return;
    this.copyBusy = true;
    try {
      const sourceDate = await this.askCopyDay(sources);
      const source = sources.find((s) => s.dateISO === sourceDate);
      if (!source) return;
      const copies = this.diary.copyEntries(source.entries, this.selectedDate());
      if (copies.length === 0) {
        this.showToast('Diese Einträge sind schon vorhanden — nichts kopiert.');
        return;
      }
      this.confirmCopy(copies, `Tag ${copyFromText(source.dateISO)}`);
    } finally {
      this.copyBusy = false;
    }
  }

  private async askCopyDay(sources: CopySource[]): Promise<string | null> {
    const hasEntries = this.groups().some((g) => g.entries.length > 0);
    const keepNote = hasEntries ? ' Vorhandene Einträge bleiben erhalten.' : '';
    const alert = await this.alertCtrl.create({
      header: 'Tag kopieren',
      message: `Alle Einträge des gewählten Tages werden zu „${this.dateLabel()}“ hinzugefügt.${keepNote}`,
      inputs: sources.map((s, i) => ({
        type: 'radio' as const,
        label: copySourceOptionText(s),
        value: s.dateISO,
        checked: i === 0,
      })),
      buttons: [
        { text: 'Abbrechen', role: 'cancel' },
        { text: 'Kopieren', role: 'confirm' },
      ],
    });
    await alert.present();
    const { role, data } = await alert.onDidDismiss<{ values?: string }>();
    return role === 'confirm' ? (data?.values ?? null) : null;
  }

  private confirmCopy(copies: DiaryEntry[], what: string): void {
    if (copies.length === 0) return;
    const kcal = formatNum(entriesKcal(copies), 0);
    this.showToast(`${what} übernommen · ${entryCountText(copies.length)} · ${kcal} kcal`, () =>
      this.diary.removeMany(copies.map((c) => c.id)),
    );
  }

  // --- Feedback ---
  private showToast(message: string, onUndo?: () => void): void {
    void showEntryToast(this.toastCtrl, message, onUndo);
  }
}
