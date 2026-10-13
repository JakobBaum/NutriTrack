import { ChangeDetectionStrategy, Component, inject, signal } from '@angular/core';
import { MealType } from '../core/models';
import { AiService } from '../core/ai/ai.service';
import { ShoppingStore } from '../core/state/shopping.store';

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
  private readonly ai = inject(AiService);

  readonly list = this.store.list;
  readonly loading = signal(false);
  readonly error = signal<string | null>(null);

  persons = 2;
  days = 5;
  budget: number | null = null;
  storeName = '';

  readonly mealToggles: { value: MealType; label: string; checked: boolean }[] = [
    { value: 'breakfast', label: 'Frühstück', checked: false },
    { value: 'lunch', label: 'Mittag', checked: true },
    { value: 'dinner', label: 'Abend', checked: true },
    { value: 'snack', label: 'Snacks', checked: false },
  ];

  readonly stores = ['', 'Spar', 'Billa', 'Hofer', 'Lidl', 'Penny'];

  newItemName = '';
  newItemAmount: number | null = null;
  newItemUnit = 'g';

  /** Zeigt an, ob gerade gegen echten Claude-Anbieter geroutet wird. */
  isLive(): boolean {
    return this.ai.isLive();
  }

  async generate(): Promise<void> {
    const meals = this.mealToggles.filter((m) => m.checked).map((m) => m.value);
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
    } catch (e: unknown) {
      this.error.set(e instanceof Error ? e.message : 'Generierung fehlgeschlagen.');
    } finally {
      this.loading.set(false);
    }
  }

  toggle(index: number): void {
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
