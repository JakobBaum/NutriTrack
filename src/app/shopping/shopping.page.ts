import { ChangeDetectionStrategy, Component, computed, inject, signal } from '@angular/core';
import { MealType } from '../core/models';
import { ShoppingStore } from '../core/state/shopping.store';

/** Eine wählbare Mahlzeit im Generator. */
export interface MealToggle {
  value: MealType;
  label: string;
  checked: boolean;
}

/**
 * Einkaufsliste: generiert einen Wocheneinkauf (Personen × Tage × Mahlzeiten ×
 * Budget) über den KI-Anbieter inkl. Schätzpreisen; abhaken/ergänzen/löschen.
 */
@Component({
  selector: 'app-shopping',
  templateUrl: './shopping.page.html',
  styleUrls: ['./shopping.page.scss'],
  standalone: false,
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class ShoppingPage {
  private readonly store = inject(ShoppingStore);

  readonly list = this.store.list;
  readonly loading = signal(false);
  readonly error = signal<string | null>(null);

  /** Ob das Formular trotz vorhandener Liste aufgeklappt ist ("Neu generieren"). */
  readonly formOpen = signal(false);
  /** Ohne Liste immer sichtbar; mit Liste nur auf Wunsch (Checkliste bleibt oben). */
  readonly showGenerator = computed(() => this.list() === null || this.formOpen());

  persons = 2;
  days = 5;
  budget: number | null = null;
  storeName = '';

  readonly mealToggles = signal<MealToggle[]>([
    { value: 'breakfast', label: 'Frühstück', checked: false },
    { value: 'lunch', label: 'Mittag', checked: true },
    { value: 'dinner', label: 'Abend', checked: true },
    { value: 'snack', label: 'Snacks', checked: false },
  ]);

  readonly stores = ['', 'Spar', 'Billa', 'Hofer', 'Lidl', 'Penny'];

  newItemName = '';
  newItemAmount: number | null = null;
  newItemUnit = 'g';

  toggleMeal(value: MealType): void {
    this.mealToggles.update((meals) =>
      meals.map((m) => (m.value === value ? { ...m, checked: !m.checked } : m)),
    );
  }

  openGenerator(): void {
    this.formOpen.set(true);
  }

  closeGenerator(): void {
    this.formOpen.set(false);
  }

  async generate(): Promise<void> {
    const meals = this.mealToggles()
      .filter((m) => m.checked)
      .map((m) => m.value);
    this.error.set(null);
    this.loading.set(true);
    try {
      await this.store.generatePlan({
        persons: this.persons,
        days: this.days,
        meals: meals.length ? meals : ['dinner'],
        budget: this.budget ?? undefined,
        store: this.storeName || undefined,
      });
      this.formOpen.set(false);
    } catch (e: unknown) {
      this.error.set(e instanceof Error ? e.message : 'Generierung fehlgeschlagen.');
    } finally {
      this.loading.set(false);
    }
  }

  toggle(index: number): void {
    this.store.toggleItem(index);
  }

  /** Setzt den Haken auf den gewünschten Zustand; doppelte Events ändern nichts. */
  setChecked(index: number, checked: boolean): void {
    const item = this.list()?.items[index];
    if (!item || item.checked === checked) return;
    this.store.toggleItem(index);
  }

  removeItem(index: number): void {
    this.store.removeItem(index);
  }

  addManual(): void {
    const name = this.newItemName.trim();
    if (!name) return;
    this.store.addItem({
      name,
      amount:
        typeof this.newItemAmount === 'number' && Number.isFinite(this.newItemAmount)
          ? this.newItemAmount
          : 1,
      unit: this.newItemUnit.trim() || 'Stk',
      checked: false,
    });
    this.newItemName = '';
    this.newItemAmount = null;
    this.newItemUnit = 'g';
  }

  overBudget(): boolean {
    const l = this.list();
    return !!l && l.budget != null && (l.estTotal ?? 0) > l.budget;
  }
}
