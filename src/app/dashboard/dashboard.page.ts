import { ChangeDetectionStrategy, Component, computed, inject, signal } from '@angular/core';
import { Router } from '@angular/router';
import { MealType, NutritionFacts } from '../core/models';
import { DiaryStore } from '../core/state/diary.store';
import { ProfileStore } from '../core/state/profile.store';
import { addDaysISO, dayLabel, toDateISO } from '../core/util/date';

interface MacroView {
  key: 'protein' | 'carbs' | 'fat' | 'fiber' | 'sugar';
  label: string;
  color: string;
  eaten: number;
  target: number;
}

interface DrillItem {
  label: string;
  value: number;
  percent: number;
}

interface DrillData {
  label: string;
  unit: string;
  total: number;
  color: string;
  items: DrillItem[];
}

interface MealView {
  type: MealType;
  label: string;
  icon: string;
  kcal: number;
}

/**
 * Tages-Dashboard ("Heute"): großer Kalorienring + Makro-Grid + Mahlzeiten.
 * Liest Ziel (ProfileStore) und Verzehr (DiaryStore) reaktiv über Signals.
 */
@Component({
  selector: 'app-dashboard',
  templateUrl: './dashboard.page.html',
  styleUrls: ['./dashboard.page.scss'],
  standalone: false,
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class DashboardPage {
  private readonly profileStore = inject(ProfileStore);
  private readonly diary = inject(DiaryStore);
  private readonly router = inject(Router);

  readonly selectedDate = signal(toDateISO());
  readonly dateLabel = computed(() => dayLabel(this.selectedDate()));
  readonly isToday = computed(() => this.selectedDate() === toDateISO());

  readonly hasProfile = this.profileStore.hasProfile;
  readonly target = this.profileStore.target;
  readonly totals = computed(() => this.diary.totalsForDate(this.selectedDate()));

  readonly kcalTarget = computed(() => this.target()?.kcal ?? 0);
  readonly kcalEaten = computed(() => Math.round(this.totals().kcal));
  readonly kcalRemaining = computed(() =>
    Math.max(0, this.kcalTarget() - this.kcalEaten()),
  );
  readonly kcalOver = computed(() => this.kcalEaten() > this.kcalTarget());

  readonly macros = computed<MacroView[]>(() => {
    const t = this.target();
    const e = this.totals();
    if (!t) return [];
    return [
      { key: 'protein', label: 'Eiweiß', color: 'var(--nt-protein)', eaten: Math.round(e.proteinG), target: t.proteinG },
      { key: 'carbs', label: 'Kohlenh.', color: 'var(--nt-carbs)', eaten: Math.round(e.carbsG), target: t.carbsG },
      { key: 'fat', label: 'Fett', color: 'var(--nt-fat)', eaten: Math.round(e.fatG), target: t.fatG },
      { key: 'fiber', label: 'Ballastst.', color: 'var(--nt-fiber)', eaten: Math.round(e.fiberG), target: t.fiberG },
      { key: 'sugar', label: 'Zucker', color: 'var(--nt-sugar)', eaten: Math.round(e.sugarG), target: t.sugarG },
    ];
  });

  readonly meals = computed<MealView[]>(() => {
    const date = this.selectedDate();
    const defs: { type: MealType; label: string; icon: string }[] = [
      { type: 'breakfast', label: 'Frühstück', icon: 'cafe-outline' },
      { type: 'lunch', label: 'Mittagessen', icon: 'fast-food-outline' },
      { type: 'dinner', label: 'Abendessen', icon: 'restaurant-outline' },
      { type: 'snack', label: 'Snacks', icon: 'ice-cream-outline' },
    ];
    return defs.map((d) => ({
      ...d,
      kcal: Math.round(this.diary.kcalForMeal(date, d.type)),
    }));
  });

  readonly drillMacro = signal<string | null>(null);

  readonly drillData = computed<DrillData | null>(() => {
    const key = this.drillMacro();
    if (!key) return null;
    const entries = this.diary.entriesForDate(this.selectedDate());
    const color = key === 'kcal'
      ? 'var(--nt-kcal)'
      : (this.macros().find(m => m.key === key)?.color ?? 'var(--ion-color-primary)');
    const label = key === 'kcal' ? 'Kalorien' : (this.macros().find(m => m.key === key)?.label ?? key);
    const unit = key === 'kcal' ? 'kcal' : 'g';
    const items = entries
      .map(e => ({ label: e.label, value: this.factValue(e.facts, key) }))
      .filter(d => d.value > 0)
      .sort((a, b) => b.value - a.value);
    const total = items.reduce((s, i) => s + i.value, 0);
    return {
      label, unit, color,
      total: Math.round(total * 10) / 10,
      items: items.map(i => ({
        ...i,
        value: Math.round(i.value * 10) / 10,
        percent: total > 0 ? Math.round((i.value / total) * 100) : 0,
      })),
    };
  });

  private factValue(facts: NutritionFacts, key: string): number {
    const map: Record<string, keyof NutritionFacts> = {
      kcal: 'kcal', protein: 'proteinG', carbs: 'carbsG',
      fat: 'fatG', fiber: 'fiberG', sugar: 'sugarG',
    };
    const prop = map[key];
    if (!prop) return 0;
    const v = facts[prop];
    return typeof v === 'number' ? v : 0;
  }

  openDrill(key: string): void { this.drillMacro.set(key); }
  closeDrill(): void { this.drillMacro.set(null); }

  prevDay(): void {
    this.selectedDate.update((d) => addDaysISO(d, -1));
  }

  nextDay(): void {
    this.selectedDate.update((d) => addDaysISO(d, 1));
  }

  openSettings(): void {
    void this.router.navigate(['/settings']);
  }

  openDiary(): void {
    void this.router.navigate(['/diary']);
  }
}
