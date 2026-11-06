import { ChangeDetectionStrategy, Component, OnDestroy, computed, inject, signal } from '@angular/core';
import { AlertController } from '@ionic/angular';
import { AiService } from '../core/ai/ai.service';
import { MealType, ShoppingItem } from '../core/models';
import { ShoppingStore, sumItems } from '../core/state/shopping.store';
import { UNDO_TOAST_BUTTONS, UNDO_TOAST_MS, UndoableDelete, settleUndoToast } from '../meals/undoable-delete';

/** Eine wählbare Mahlzeit im Generator. */
export interface MealToggle {
  value: MealType;
  label: string;
  checked: boolean;
}

/** Eine Position samt Index in der gespeicherten Liste. */
export interface ShoppingRow {
  item: ShoppingItem;
  index: number;
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
export class ShoppingPage implements OnDestroy {
  private readonly store = inject(ShoppingStore);
  private readonly ai = inject(AiService);
  private readonly alertCtrl = inject(AlertController);

  private readonly deletion = new UndoableDelete((id) => this.store.removeItem(Number(id)));
  readonly undoOpen = signal(false);
  readonly undoDuration = UNDO_TOAST_MS;
  readonly undoButtons = UNDO_TOAST_BUTTONS;

  readonly list = this.store.list;

  /** Positionen ohne die gerade zum Löschen vorgemerkte (Index = Position in der Liste). */
  readonly rows = computed<ShoppingRow[]>(() => {
    const pending = this.deletion.pendingId();
    return (this.list()?.items ?? [])
      .map((item, index) => ({ item, index }))
      .filter((r) => String(r.index) !== pending);
  });

  /** Summe aus den sichtbaren Positionen; `unpriced` = Positionen ohne Schätzpreis. */
  readonly totals = computed(() => {
    const all = this.rows().map((r) => r.item);
    const sum = sumItems(all);
    const open = sumItems(all.filter((i) => !i.checked));
    const hasChecked = all.some((i) => i.checked);
    return { total: sum.total, unpriced: sum.unpriced, open: hasChecked ? open.total : null };
  });

  /** Badge-Text je Preisquelle; Altlisten ohne Quelle folgen dem aktiven Anbieter. */
  readonly priceLabel = computed(() => {
    const source = this.list()?.priceSource ?? (this.ai.isLive() ? 'ai' : 'mock');
    return source === 'mock' ? 'Grobe Schätzung (Demo-Formel)' : 'KI-Schätzung';
  });
  readonly isMockPrice = computed(() => this.priceLabel() !== 'KI-Schätzung');
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

  ngOnDestroy(): void {
    this.deletion.flush();
  }

  private async confirmRegenerate(): Promise<boolean> {
    const alert = await this.alertCtrl.create({
      header: 'Neu generieren?',
      message:
        'Die Liste wird neu berechnet. Abgehakte und selbst hinzugefügte Positionen bleiben erhalten, alle anderen werden ersetzt.',
      buttons: [
        { text: 'Abbrechen', role: 'cancel' },
        { text: 'Neu generieren', role: 'confirm' },
      ],
    });
    await alert.present();
    const { role } = await alert.onDidDismiss();
    return role === 'confirm';
  }

  async generate(): Promise<void> {
    if (!Number.isInteger(this.persons) || this.persons < 1) {
      this.error.set('Personen: bitte eine ganze Zahl ab 1 angeben.');
      return;
    }
    if (!Number.isInteger(this.days) || this.days < 1) {
      this.error.set('Tage: bitte eine ganze Zahl ab 1 angeben.');
      return;
    }
    this.deletion.flush();
    const existing = this.list();
    if (existing && existing.items.length > 0 && !(await this.confirmRegenerate())) return;
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

  /** Blendet die Position aus und zeigt „Gelöscht – Rückgängig“. */
  removeItem(index: number): void {
    // Ein offenes früheres Löschen wird endgültig und verschiebt spätere Indizes.
    const pending = this.deletion.pendingId();
    this.deletion.flush();
    const adjusted = pending !== null && Number(pending) < index ? index - 1 : index;
    this.deletion.start(String(adjusted));
    this.undoOpen.set(true);
  }

  onUndoDismiss(event: CustomEvent<{ role?: string }>): void {
    settleUndoToast(this.deletion, event.detail?.role);
    this.undoOpen.set(false);
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
    return !!l && l.budget != null && this.totals().total > l.budget;
  }
}
