import { ChangeDetectionStrategy, Component, computed, inject, signal } from '@angular/core';
import { DiaryEntry, MealType } from '../core/models';
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

/**
 * Tagebuch: zeigt die Einträge eines Tages je Mahlzeit und erlaubt das
 * Hinzufügen (manuell) sowie Löschen. Barcode-/Etikett-Scan folgt später.
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

  readonly isModalOpen = signal(false);
  readonly error = signal<string | null>(null);
  form: EntryForm = { ...EMPTY_FORM };

  prevDay(): void {
    this.selectedDate.update((d) => addDaysISO(d, -1));
  }

  nextDay(): void {
    this.selectedDate.update((d) => addDaysISO(d, 1));
  }

  openAdd(meal: MealType = 'breakfast'): void {
    this.form = { ...EMPTY_FORM, meal };
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
}
