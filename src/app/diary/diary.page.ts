import { ChangeDetectionStrategy, Component, computed, inject, signal } from '@angular/core';
import { DiaryEntry, FastFoodSuggestion, FoodItem, MealType } from '../core/models';
import { AiService } from '../core/ai/ai.service';
import { FOOD_PROVIDER } from '../core/food/food-provider';
import { DiaryStore } from '../core/state/diary.store';
import { ProfileStore } from '../core/state/profile.store';
import { addDaysISO, dayLabel, toDateISO } from '../core/util/date';

interface MealGroup {
  type: MealType;
  label: string;
  icon: string;
  entries: DiaryEntry[];
  kcal: number;
}

interface EntryForm {
  label: string;
  meal: MealType;
  kcal: number | null;
  proteinG: number | null;
  carbsG: number | null;
  fatG: number | null;
  fiberG: number | null;
  sugarG: number | null;
}

const EMPTY_FORM: EntryForm = {
  label: '',
  meal: 'breakfast',
  kcal: null,
  proteinG: null,
  carbsG: null,
  fatG: null,
  fiberG: null,
  sugarG: null,
};

interface FastFoodForm {
  restaurant: string;
  kcalBudget: number | null;
  moneyBudget: number | null;
  preference: string;
}

/**
 * Tagebuch: Einträge je Mahlzeit, hinzufügen (manuell, Food-Textsuche via
 * OpenFoodFacts, Etikett-Scan via KI-Vision) und löschen. Plus Fastfood-Helfer.
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
  private readonly food = inject(FOOD_PROVIDER);
  private readonly ai = inject(AiService);

  readonly selectedDate = signal(toDateISO());
  readonly dateLabel = computed(() => dayLabel(this.selectedDate()));
  readonly isToday = computed(() => this.selectedDate() === toDateISO());

  readonly totalKcal = computed(() =>
    Math.round(this.diary.totalsForDate(this.selectedDate()).kcal),
  );
  readonly targetKcal = computed(() => this.profileStore.target()?.kcal ?? 0);

  readonly groups = computed<MealGroup[]>(() => {
    const date = this.selectedDate();
    const defs: { type: MealType; label: string; icon: string }[] = [
      { type: 'breakfast', label: 'Frühstück', icon: 'cafe-outline' },
      { type: 'lunch', label: 'Mittagessen', icon: 'fast-food-outline' },
      { type: 'dinner', label: 'Abendessen', icon: 'restaurant-outline' },
      { type: 'snack', label: 'Snacks', icon: 'ice-cream-outline' },
    ];
    return defs.map((d) => {
      const entries = this.diary.entriesForMeal(date, d.type);
      const kcal = entries.reduce((s, e) => s + (e.facts.kcal || 0), 0);
      return { ...d, entries, kcal: Math.round(kcal) };
    });
  });

  readonly mealOptions: { value: MealType; label: string }[] = [
    { value: 'breakfast', label: 'Frühstück' },
    { value: 'lunch', label: 'Mittagessen' },
    { value: 'dinner', label: 'Abendessen' },
    { value: 'snack', label: 'Snacks' },
  ];

  // --- Add-entry modal state ---
  readonly isModalOpen = signal(false);
  readonly error = signal<string | null>(null);
  form: EntryForm = { ...EMPTY_FORM };

  // --- Food search ---
  searchQuery = '';
  readonly searchResults = signal<FoodItem[]>([]);
  readonly searching = signal(false);
  readonly scanning = signal(false);
  readonly hint = signal<string | null>(null);

  // --- Fastfood helper ---
  readonly ffOpen = signal(false);
  readonly ffLoading = signal(false);
  readonly ffResults = signal<FastFoodSuggestion[]>([]);
  ff: FastFoodForm = { restaurant: 'McDonald’s', kcalBudget: null, moneyBudget: null, preference: 'viel Protein' };

  isLive(): boolean {
    return this.ai.isLive();
  }

  prevDay(): void {
    this.selectedDate.update((d) => addDaysISO(d, -1));
  }

  nextDay(): void {
    this.selectedDate.update((d) => addDaysISO(d, 1));
  }

  openAdd(meal: MealType = 'breakfast'): void {
    this.form = { ...EMPTY_FORM, meal };
    this.searchQuery = '';
    this.searchResults.set([]);
    this.hint.set(null);
    this.error.set(null);
    this.isModalOpen.set(true);
  }

  closeAdd(): void {
    this.isModalOpen.set(false);
  }

  remove(id: string): void {
    this.diary.remove(id);
  }

  private toNum(v: number | null): number {
    return typeof v === 'number' && Number.isFinite(v) ? v : 0;
  }

  async searchFood(): Promise<void> {
    const q = this.searchQuery.trim();
    if (!q) return;
    this.error.set(null);
    this.searching.set(true);
    try {
      this.searchResults.set(await this.food.searchByText(q));
      if (this.searchResults().length === 0) this.hint.set('Keine Treffer gefunden.');
    } catch {
      this.error.set('Suche fehlgeschlagen (Netzwerk?).');
    } finally {
      this.searching.set(false);
    }
  }

  /** Übernimmt die Nährwerte (pro 100 g) eines Treffers in das Formular. */
  selectFood(item: FoodItem): void {
    this.form.label = item.name;
    this.form.kcal = Math.round(item.facts.kcal);
    this.form.proteinG = Math.round(item.facts.proteinG);
    this.form.carbsG = Math.round(item.facts.carbsG);
    this.form.fatG = Math.round(item.facts.fatG);
    this.form.fiberG = item.facts.fiberG != null ? Math.round(item.facts.fiberG) : null;
    this.form.sugarG = item.facts.sugarG != null ? Math.round(item.facts.sugarG) : null;
    this.searchResults.set([]);
    this.searchQuery = '';
    this.hint.set('Werte pro 100 g übernommen — bei Bedarf anpassen.');
  }

  /** Liest ein Etiketten-Foto per KI-Vision und füllt das Formular. */
  async onLabelFile(event: Event): Promise<void> {
    const input = event.target as HTMLInputElement;
    const file = input.files?.[0];
    if (!file) return;
    this.error.set(null);
    this.scanning.set(true);
    try {
      const base64 = await this.fileToBase64(file);
      const res = await this.ai.recognizeLabel(base64, 'per100g');
      this.form.label = res.name;
      this.form.kcal = Math.round(res.facts.kcal);
      this.form.proteinG = Math.round(res.facts.proteinG);
      this.form.carbsG = Math.round(res.facts.carbsG);
      this.form.fatG = Math.round(res.facts.fatG);
      this.form.fiberG = res.facts.fiberG != null ? Math.round(res.facts.fiberG) : null;
      this.form.sugarG = res.facts.sugarG != null ? Math.round(res.facts.sugarG) : null;
      this.hint.set(
        this.isLive()
          ? 'Etikett erkannt (pro 100 g) — bitte prüfen.'
          : 'Mock-Werte eingetragen (KI-Key in Profil für echte Erkennung).',
      );
    } catch (e: unknown) {
      this.error.set(e instanceof Error ? e.message : 'Etikett-Erkennung fehlgeschlagen.');
    } finally {
      this.scanning.set(false);
      input.value = '';
    }
  }

  private fileToBase64(file: File): Promise<string> {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = () => {
        const result = String(reader.result);
        resolve(result.includes(',') ? result.split(',')[1] : result);
      };
      reader.onerror = () => reject(new Error('Datei konnte nicht gelesen werden.'));
      reader.readAsDataURL(file);
    });
  }

  save(): void {
    const label = this.form.label.trim();
    if (!label) {
      this.error.set('Bitte einen Namen eingeben.');
      return;
    }
    const kcal = this.form.kcal;
    if (kcal === null || !Number.isFinite(kcal) || kcal < 0) {
      this.error.set('Bitte gültige Kalorien (kcal) eingeben.');
      return;
    }
    this.diary.add({
      dateISO: this.selectedDate(),
      meal: this.form.meal,
      label,
      facts: {
        kcal: Math.round(kcal),
        proteinG: this.toNum(this.form.proteinG),
        carbsG: this.toNum(this.form.carbsG),
        fatG: this.toNum(this.form.fatG),
        fiberG: this.toNum(this.form.fiberG),
        sugarG: this.toNum(this.form.sugarG),
        basis: 'perPortion',
      },
    });
    this.closeAdd();
  }

  // --- Fastfood helper ---
  openFastfood(): void {
    this.ffResults.set([]);
    this.error.set(null);
    this.ffOpen.set(true);
  }

  closeFastfood(): void {
    this.ffOpen.set(false);
  }

  async runFastfood(): Promise<void> {
    this.error.set(null);
    this.ffLoading.set(true);
    try {
      this.ffResults.set(
        await this.ai.suggestFastfood({
          restaurant: this.ff.restaurant.trim() || 'Fastfood',
          kcalBudget: this.toNum(this.ff.kcalBudget),
          moneyBudget: this.ff.moneyBudget ?? undefined,
          preference: this.ff.preference,
        }),
      );
    } catch (e: unknown) {
      this.error.set(e instanceof Error ? e.message : 'Vorschläge fehlgeschlagen.');
    } finally {
      this.ffLoading.set(false);
    }
  }

  logFastfood(s: FastFoodSuggestion): void {
    this.diary.add({
      dateISO: this.selectedDate(),
      meal: 'lunch',
      label: `${s.itemName} (${s.restaurant})`,
      facts: s.facts,
    });
    this.closeFastfood();
  }
}
