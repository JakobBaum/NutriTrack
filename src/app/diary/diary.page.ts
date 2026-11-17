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
import { DiaryEntry, MealType } from '../core/models';
import { CopySource, DiaryStore } from '../core/state/diary.store';
import { ProfileStore } from '../core/state/profile.store';
import { dayLabel, rollDate, toDateISO } from '../core/util/date';
import { formatNum } from '../shared/num.pipe';
import { MEAL_DEFS, mealForHour } from './diary-helpers';
import { parseDiaryQuery, summarizeDay } from './diary-day';
import { pickEntryAction } from './entry-menu';
import { lightHaptic } from './haptics';
import { WRITE_BLOCKED_MESSAGE } from '../core/storage/storage-messages';
import { showEntryToast } from './entry-toast';
import { entryToInput } from './diary-edit';
import { EntryPatch } from './edit-entry-sheet/edit-entry-logic';
import { EditedEntry } from './edit-entry-sheet/edit-entry-sheet.component';
import { ensureWritable } from './write-guard';
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
  private readonly route = inject(ActivatedRoute);
  private readonly router = inject(Router);
  private readonly resume = inject(AppResumeService);
  private readonly toastCtrl = inject(ToastController);
  private readonly alertCtrl = inject(AlertController);
  private readonly sheetCtrl = inject(ActionSheetController);

  /** Tagebuch zeigt entweder einen Tag oder die letzten 7 Tage. */
  readonly view = signal<'day' | 'week'>('day');

  setView(value: unknown): void {
    this.view.set(value === 'week' ? 'week' : 'day');
  }

  readonly selectedDate = signal(toDateISO());
  /** Der Tag, den die Seite zuletzt als "heute" kannte (für den Tageswechsel). */
  private readonly today = signal(toDateISO());
  readonly dateLabel = computed(() => dayLabel(this.selectedDate()));

  private readonly summary = computed(() =>
    summarizeDay(this.diary.totalsForDate(this.selectedDate()), this.profileStore.target()),
  );
  readonly totalKcal = computed(() => this.summary().totalKcal);
  readonly targetKcal = computed(() => this.summary().targetKcal);
  readonly totalProtein = computed(() => this.summary().totalProtein);
  readonly targetProtein = computed(() => this.summary().targetProtein);
  /** Eiweiß, das zum Tagesziel noch fehlt (0, wenn erreicht oder ohne Ziel). */
  readonly remainingProtein = computed(() => this.summary().remainingProtein);
  /** Verbleibende kcal des gewählten Tages (0, wenn das Ziel erreicht oder überschritten ist). */
  readonly remainingKcal = computed(() => this.summary().remainingKcal);
  readonly overKcal = computed(() => this.summary().overKcal);

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

  /** Eintrag im Bearbeiten-Sheet (null = zu); das Sheet ist eine eigene Komponente. */
  readonly editEntry = signal<DiaryEntry | null>(null);

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
   * Liest `?add=<meal>` (öffnet das Eintragen-Sheet), `?meal=` (Scroll-Ziel) und `?date=`
   * einmalig und entfernt sie danach aus der URL.
   */
  private handleQuery(params: ParamMap): void {
    const query = parseDiaryQuery(params);
    if (query.date) this.selectedDate.set(query.date);
    if (!query.hasAny) return;

    if (query.wantsAdd) {
      if (!query.date) this.selectedDate.set(toDateISO());
      this.openAdd(query.addMeal ?? this.currentMeal());
    }
    const scrollMeal = query.scrollMeal;
    if (scrollMeal) setTimeout(() => this.scrollToMeal(scrollMeal), SCROLL_TO_MEAL_DELAY_MS);

    void this.router.navigate([], {
      relativeTo: this.route,
      queryParams: { add: null, date: null, meal: null },
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
  openEdit(entry: DiaryEntry): void {
    this.editEntry.set(entry);
  }

  closeEdit(): void {
    this.editEntry.set(null);
  }

  /** „Doppelt eintragen“ aus dem Bearbeiten-Sheet: die Kopie bekommt die dort eingegebenen Änderungen. */
  duplicateEdited({ entry, patch }: EditedEntry): void {
    this.duplicate(entry, patch);
  }

  /** Löscht einen Eintrag; „Rückgängig“ legt ihn (am Ende der Mahlzeit) neu an. */
  remove(entry: DiaryEntry): void {
    if (!ensureWritable(this.diary, this.toastCtrl)) return;
    lightHaptic();
    const index = this.diary.indexOf(entry.id);
    this.diary.remove(entry.id);
    // Rückgängig stellt den Eintrag mit alter Id und an alter Position wieder her.
    this.showToast(`„${entry.label}“ gelöscht`, () => {
      if (ensureWritable(this.diary, this.toastCtrl)) this.diary.restore(entry, index);
    });
  }

  /** „Mehr“-Menü einer Zeile: sichtbarer Weg zu Bearbeiten, Doppelt eintragen und Löschen. */
  async openEntryMenu(entry: DiaryEntry): Promise<void> {
    const action = await pickEntryAction(this.sheetCtrl, entry.label);
    if (action === 'edit') this.openEdit(entry);
    else if (action === 'duplicate') this.duplicate(entry);
    else if (action === 'delete') this.remove(entry);
  }

  /** Doppelt eintragen: Kopie am Ende der Mahlzeit (optional mit geänderten Werten), mit „Rückgängig“. */
  duplicate(entry: DiaryEntry, patch?: EntryPatch): void {
    if (!ensureWritable(this.diary, this.toastCtrl)) return;
    const copy = this.diary.tryAdd(entryToInput(entry));
    if (!copy) {
      void showEntryToast(this.toastCtrl, WRITE_BLOCKED_MESSAGE);
      return;
    }
    if (patch) this.diary.update(copy.id, patch);
    lightHaptic();
    this.showToast(`„${patch?.label?.trim() || entry.label}“ doppelt eingetragen`, () => {
      if (ensureWritable(this.diary, this.toastCtrl)) this.diary.remove(copy.id);
    });
  }

  // --- Wie gestern / Tag kopieren ---
  readonly copyFromButtonText = copyFromButtonText;
  /** Sperrt „Tag kopieren“ gegen Doppelklick, solange der Dialog offen ist. */
  private copyBusy = false;

  /** Übernimmt eine leere Mahlzeit vom letzten Tag, an dem sie Einträge hatte. */
  copyMeal(group: MealGroup): void {
    if (!group.copySource || this.copyBusy || !ensureWritable(this.diary, this.toastCtrl)) return;
    const copies = this.diary.copyEntries(group.copySource.entries, this.selectedDate());
    this.confirmCopy(copies, `${group.label} ${copyFromText(group.copySource.dateISO)}`);
  }

  /** Fragt den Quelltag ab (letzte 7 Tage) und kopiert ihn nach Bestätigung in den gezeigten Tag. */
  async copyDay(): Promise<void> {
    const sources = this.daySources();
    if (sources.length === 0 || this.copyBusy) return;
    if (!ensureWritable(this.diary, this.toastCtrl)) return;
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
    this.showToast(`${what} übernommen · ${entryCountText(copies.length)} · ${kcal} kcal`, () => {
      if (ensureWritable(this.diary, this.toastCtrl)) this.diary.removeMany(copies.map((c) => c.id));
    });
  }

  // --- Feedback ---
  private showToast(message: string, onUndo?: () => void): void {
    void showEntryToast(this.toastCtrl, message, onUndo);
  }
}
