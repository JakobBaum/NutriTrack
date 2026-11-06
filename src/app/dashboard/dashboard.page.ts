import { ChangeDetectionStrategy, Component, computed, inject, signal } from '@angular/core';
import { Router } from '@angular/router';
import { MealType, NutritionFacts } from '../core/models';
import { DiaryStore } from '../core/state/diary.store';
import { ProfileStore } from '../core/state/profile.store';
import { formatNum } from '../shared/num.pipe';
import { addDaysISO, dayLabel, toDateISO } from '../core/util/date';
import { MEAL_DEFS, mealForHour, mealLabel } from '../diary/diary-helpers';

interface MacroView {
  key: 'kcal' | 'protein' | 'carbs' | 'fat' | 'fiber' | 'sugar';
  label: string;
  unit: string;
  color: string;
  track: string;
  eaten: number;
  target: number;
  /** Anteil über dem Ziel, ab dem die Warnfarbe greift (kcal: 0, Makros: 10 %). */
  warnAbove: number;
  /** Überschreitung in Einheiten (0, solange das Ziel nicht überschritten ist). */
  overBy: number;
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
  /** True, wenn das Ziel dieses Werts deutlich überschritten ist (Warnfarbe). */
  over: boolean;
  items: DrillItem[];
}

interface MealView {
  type: MealType;
  label: string;
  icon: string;
  kcal: number;
  count: number;
}

const MACRO_WARN_ABOVE = 0.1;

/**
 * Tages-Dashboard ("Heute"): Kalorien-Hero + sechs Nährwertringe + Mahlzeiten.
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
  /** Ausgeschriebenes Datum fuer die Navigationsleiste, z.B. "Donnerstag, 5. November". */
  readonly fullDate = computed(() =>
    new Intl.DateTimeFormat('de-AT', { weekday: 'long', day: 'numeric', month: 'long' }).format(
      new Date(`${this.selectedDate()}T12:00:00`),
    ),
  );

  readonly hasProfile = this.profileStore.hasProfile;
  readonly target = this.profileStore.target;
  readonly totals = computed(() => this.diary.totalsForDate(this.selectedDate()));

  readonly kcalTarget = computed(() => this.target()?.kcal ?? 0);
  readonly kcalEaten = computed(() => Math.round(this.totals().kcal));
  readonly kcalRemaining = computed(() =>
    Math.max(0, this.kcalTarget() - this.kcalEaten()),
  );
  /** kcal über dem Tagesziel (0, solange das Ziel nicht überschritten ist). */
  readonly kcalOverBy = computed(() => Math.max(0, this.kcalEaten() - this.kcalTarget()));

  /** Screenreader-Name des Heros inkl. Zahl und Ueberschreitung. */
  readonly heroLabel = computed(() => {
    const over = this.kcalOverBy();
    const n = formatNum(over > 0 ? over : this.kcalRemaining(), 0);
    return `${n} kcal ${over > 0 ? 'über Ziel' : 'übrig'}, Details anzeigen`;
  });

  readonly macros = computed<MacroView[]>(() => {
    const t = this.target();
    const e = this.totals();
    if (!t) return [];
    const mk = (
      key: MacroView['key'], label: string, unit: string, color: string, eaten: number, target: number,
    ): MacroView => ({
      key, label, unit, color, track: 'var(--nt-track)', eaten, target,
      warnAbove: key === 'kcal' ? 0 : MACRO_WARN_ABOVE,
      overBy: Math.max(0, eaten - target),
    });
    return [
      mk('kcal', 'Kalorien', 'kcal', 'var(--nt-kcal)', Math.round(e.kcal), t.kcal),
      mk('protein', 'Eiweiß', 'g', 'var(--nt-protein)', Math.round(e.proteinG), t.proteinG),
      mk('carbs', 'Kohlenhydrate', 'g', 'var(--nt-carbs)', Math.round(e.carbsG), t.carbsG),
      mk('fat', 'Fett', 'g', 'var(--nt-fat)', Math.round(e.fatG), t.fatG),
      mk('fiber', 'Ballaststoffe', 'g', 'var(--nt-fiber)', Math.round(e.fiberG), t.fiberG),
      mk('sugar', 'Zucker', 'g', 'var(--nt-sugar)', Math.round(e.sugarG), t.sugarG),
    ];
  });

  readonly meals = computed<MealView[]>(() => {
    const date = this.selectedDate();
    return MEAL_DEFS.map((d) => ({
      ...d,
      kcal: Math.round(this.diary.kcalForMeal(date, d.type)),
      count: this.diary.entriesForMeal(date, d.type).length,
    }));
  });

  /** True, solange am gewählten Tag nichts eingetragen ist. */
  readonly isEmptyDay = computed(() => this.diary.entriesForDate(this.selectedDate()).length === 0);

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
    const macro = this.macros().find(m => m.key === key);
    const over = !!macro && macro.target > 0 && macro.eaten > macro.target * (1 + macro.warnAbove);
    const items = entries
      .map(e => ({ label: e.label, value: this.factValue(e.facts, key) }))
      .filter(d => d.value > 0)
      .sort((a, b) => b.value - a.value);
    const total = items.reduce((s, i) => s + i.value, 0);
    return {
      label, unit, color, over,
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
    void this.router.navigate(['/settings'], { queryParams: { setup: '1' } });
  }

  openDiary(meal?: MealType): void {
    if (!meal) {
      void this.router.navigate(['/diary']);
      return;
    }
    const date = this.selectedDate();
    const queryParams: Record<string, string> = { meal };
    if (date !== toDateISO()) queryParams['date'] = date;
    void this.router.navigate(['/diary'], { queryParams });
  }

  /** Text unter der Mahlzeit, z.B. "2 Einträge". */
  entryCountLabel(count: number): string {
    return count === 1 ? '1 Eintrag' : `${count} Einträge`;
  }

  /** Mahlzeit, die zur aktuellen Uhrzeit passt (Ziel des FAB). */
  currentMeal(): MealType {
    return mealForHour(new Date().getHours());
  }

  currentMealLabel(): string {
    return mealLabel(this.currentMeal());
  }

  /** FAB: öffnet im Tagebuch direkt das Add-Modal für die passende Mahlzeit. */
  openAddForNow(): void {
    const date = this.selectedDate();
    const queryParams: Record<string, string> = { add: this.currentMeal() };
    if (date !== toDateISO()) queryParams['date'] = date;
    void this.router.navigate(['/diary'], { queryParams });
  }

  /** Öffnet den Fastfood-Helfer im Tagebuch (einzige Implementierung). */
  openFastfood(): void {
    void this.router.navigate(['/diary'], { queryParams: { fastfood: '1' } });
  }
}
