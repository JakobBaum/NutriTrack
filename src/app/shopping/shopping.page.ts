import { ChangeDetectionStrategy, Component, ElementRef, OnDestroy, computed, inject, signal, viewChild } from '@angular/core';
import { AlertController } from '@ionic/angular';
import { formatDecimal, parseDecimal } from '../core/util/number-input';
import { UNIT_OPTIONS } from '../core/util/units';
import { AiService } from '../core/ai/ai.service';
import { MealType } from '../core/models';
import { ProfileStore } from '../core/state/profile.store';
import { RecipeStore } from '../core/state/recipe.store';
import { ShoppingStore, sumItems } from '../core/state/shopping.store';
import { UNDO_TOAST_BUTTONS, UNDO_TOAST_MS, UndoableDelete, settleUndoToast } from '../meals/undoable-delete';
import {
  BUDGET_PRESETS,
  DAYS_MAX,
  DAYS_MIN,
  DAY_PRESETS,
  PERSONS_MAX,
  PERSONS_MIN,
  ShoppingRow,
  adjustIndex,
  categoryLabel,
  decodeIndexes,
  defaultPersonsInRange,
  encodeIndexes,
  formatShareText,
  groupByCategory,
  scaleRecipeIngredients,
  splitRows,
} from './shopping-list.util';

export type { ShoppingRow } from './shopping-list.util';

/** Eine wählbare Mahlzeit im Generator. */
export interface MealToggle {
  value: MealType;
  label: string;
  checked: boolean;
}

/** Dauer des Hinweises nach „Liste teilen“ in ms. */
const SHARE_TOAST_MS = 2500;

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
  private readonly profileStore = inject(ProfileStore);
  private readonly ai = inject(AiService);
  private readonly recipeStore = inject(RecipeStore);
  private readonly alertCtrl = inject(AlertController);

  /** Eine ID = Komma-Liste von Indizes (Einzel- oder Sammel-Löschen). */
  private readonly deletion = new UndoableDelete((id) => this.commitRemoval(decodeIndexes(id)));
  readonly undoOpen = signal(false);
  readonly undoMessage = signal('Position gelöscht');
  readonly undoDuration = UNDO_TOAST_MS;
  readonly undoButtons = UNDO_TOAST_BUTTONS;

  readonly list = this.store.list;

  /** Positionen ohne die gerade zum Löschen vorgemerkten (Index = Position in der Liste). */
  readonly rows = computed<ShoppingRow[]>(() => {
    const pending = new Set(decodeIndexes(this.deletion.pendingId()));
    return (this.list()?.items ?? [])
      .map((item, index) => ({ item, index }))
      .filter((r) => !pending.has(r.index));
  });

  private readonly split = computed(() => splitRows(this.rows()));
  /** Offene Positionen, nach Supermarkt-Kategorie gruppiert (falls vorhanden). */
  readonly openGroups = computed(() => groupByCategory(this.split().open));
  readonly openCount = computed(() => this.split().open.length);
  /** Abgehakte Positionen für den Bereich „Erledigt“. */
  readonly doneRows = computed(() => this.split().done);
  /** Ob „Erledigt (n)“ aufgeklappt ist. */
  readonly doneOpen = signal(false);

  readonly shareToastOpen = signal(false);
  readonly shareToastMessage = signal('');
  readonly shareToastDuration = SHARE_TOAST_MS;

  /** Summe aus den sichtbaren Positionen; nur echte bzw. eingetragene Preise zählen. */
  readonly totals = computed(() => {
    const all = this.rows().map((r) => r.item);
    const sum = sumItems(all);
    const open = sumItems(all.filter((i) => !i.checked));
    return { total: sum.total, unpriced: sum.unpriced, open: open.total, priced: all.length - sum.unpriced };
  });

  /** Echte KI-Verbindung aktiv (nur dann gibt es geschätzte Preise, Budget und Markt). */
  readonly live = computed(() => this.ai.isLive());
  /** Ohne KI keine Rezepte = nichts zu generieren. */
  readonly hasRecipes = computed(() => this.recipeStore.recipes().length > 0);
  readonly noRecipesBlock = computed(() => !this.live() && !this.hasRecipes());
  /** Summen zeigen, wenn die Liste KI-Preise hat oder mindestens ein Preis eingetragen ist. */
  readonly showTotals = computed(() => this.totals().priced > 0);
  readonly isMockPrice = computed(() => (this.list()?.priceSource ?? (this.live() ? 'ai' : 'mock')) === 'mock');

  readonly personsMin = PERSONS_MIN;
  readonly personsMax = PERSONS_MAX;
  readonly daysMin = DAYS_MIN;
  readonly daysMax = DAYS_MAX;
  readonly dayPresets = DAY_PRESETS;
  readonly budgetPresets = BUDGET_PRESETS;
  readonly loading = signal(false);
  readonly error = signal<string | null>(null);

  /** Ob das Formular trotz vorhandener Liste aufgeklappt ist ("Neu generieren"). */
  readonly formOpen = signal(false);
  /** Ohne Liste immer sichtbar; mit Liste nur auf Wunsch (Checkliste bleibt oben). */
  readonly showGenerator = computed(() => this.list() === null || this.formOpen());

  /** Vorbelegung aus dem Profil, sonst aus der letzten generierten Liste. */
  persons = defaultPersonsInRange(this.profileStore.profile(), this.lastGeneratedPersons());
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
  newItemAmountText = '';
  readonly categoryLabel = categoryLabel;
  readonly parseDecimal = parseDecimal;
  readonly formatDecimal = formatDecimal;
  readonly unitOptions = UNIT_OPTIONS;
  // read: ElementRef, sonst liefert viewChild die IonInput-Instanz (ohne nativeElement).
  private readonly addNameInput = viewChild<string, ElementRef<HTMLElement & { setFocus?: () => Promise<void> }>>(
    'addName',
    { read: ElementRef },
  );
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

  /** Personen der letzten generierten Liste (rein manuelle Listen zählen nicht). */
  private lastGeneratedPersons(): number | undefined {
    const l = this.store.list();
    return l && (l.days ?? null) !== null ? l.persons : undefined;
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
    const pending = decodeIndexes(this.deletion.pendingId());
    this.deletion.flush();
    this.startDeletion([adjustIndex(index, pending)], 'Position gelöscht');
  }

  /** Blendet alle abgehakten Positionen aus („Erledigte entfernen“, mit Rückgängig). */
  removeChecked(): void {
    this.deletion.flush();
    const checked = (this.list()?.items ?? [])
      .map((item, index) => ({ item, index }))
      .filter((r) => r.item.checked)
      .map((r) => r.index);
    if (checked.length === 0) return;
    const message =
      checked.length === 1 ? '1 erledigte Position entfernt' : `${checked.length} erledigte Positionen entfernt`;
    this.startDeletion(checked, message);
  }

  toggleDone(): void {
    this.doneOpen.update((open) => !open);
  }

  onUndoDismiss(event: CustomEvent<{ role?: string }>): void {
    settleUndoToast(this.deletion, event.detail?.role);
    this.undoOpen.set(false);
  }

  private startDeletion(indexes: readonly number[], message: string): void {
    this.deletion.start(encodeIndexes(indexes));
    this.undoMessage.set(message);
    this.undoOpen.set(true);
  }

  /** Entfernt endgültig, von hinten nach vorn, damit Indizes gültig bleiben. */
  private commitRemoval(indexes: readonly number[]): void {
    [...indexes].sort((a, b) => b - a).forEach((i) => this.store.removeItem(i));
  }

  /** Teilt die offenen Positionen per Web Share API; sonst Zwischenablage + Hinweis. */
  async shareList(): Promise<void> {
    if (this.openCount() === 0) {
      this.showShareToast('Nichts zu teilen: alle Positionen sind erledigt.');
      return;
    }
    const text = formatShareText(this.rows().map((r) => r.item));
    const nav = typeof navigator === 'undefined' ? undefined : navigator;
    if (typeof nav?.share === 'function') {
      try {
        await nav.share({ title: 'Einkaufsliste', text });
        return;
      } catch (e: unknown) {
        // Abbruch durch den Nutzer ist kein Fehler; sonst Zwischenablage versuchen.
        if (e instanceof DOMException && e.name === 'AbortError') return;
      }
    }
    await this.copyToClipboard(text, nav);
  }

  private async copyToClipboard(text: string, nav: Navigator | undefined): Promise<void> {
    try {
      if (typeof nav?.clipboard?.writeText !== 'function') throw new Error('Zwischenablage nicht verfügbar');
      await nav.clipboard.writeText(text);
      this.showShareToast('Liste in die Zwischenablage kopiert');
    } catch (e: unknown) {
      console.error('Einkaufsliste teilen fehlgeschlagen', e);
      this.showShareToast('Teilen nicht möglich. Bitte erneut versuchen.');
    }
  }

  private showShareToast(message: string): void {
    this.shareToastMessage.set(message);
    this.shareToastOpen.set(true);
  }

  onShareToastDismiss(): void {
    this.shareToastOpen.set(false);
  }

  /** Tippen auf ein Gericht: seine Zutaten (auf die Personenzahl skaliert) landen in der Liste. */
  addDish(title: string): void {
    const recipe = this.recipeStore.recipes().find((r) => r.title === title);
    const items = recipe ? scaleRecipeIngredients(recipe, this.list()?.persons ?? this.persons) : [];
    if (items.length === 0) {
      this.showShareToast(`${title}: keine Zutaten hinterlegt`);
      return;
    }
    items.forEach((it) => this.store.addItem(it));
    this.showShareToast(`${items.length} Zutaten von ${title} hinzugefügt`);
  }

  setBudget(value: number | null): void {
    this.budget = value;
  }

  setDays(value: number): void {
    this.days = value;
  }

  setPersons(value: number): void {
    this.persons = value;
  }

  /** Eigenen Preis einer Position eintragen oder löschen (leer lassen). */
  async editPrice(index: number): Promise<void> {
    const item = this.list()?.items[index];
    if (!item) return;
    const alert = await this.alertCtrl.create({
      header: 'Preis eintragen',
      subHeader: item.name,
      inputs: [
        {
          name: 'price',
          type: 'text',
          placeholder: 'Preis in €',
          value: item.estPrice != null ? formatDecimal(item.estPrice) : '',
          attributes: { inputmode: 'decimal' },
        },
      ],
      buttons: [
        { text: 'Abbrechen', role: 'cancel' },
        { text: 'Speichern', role: 'confirm' },
      ],
    });
    await alert.present();
    const { role, data } = await alert.onDidDismiss<{ values?: { price?: string } }>();
    if (role !== 'confirm') return;
    const raw = String(data?.values?.price ?? '').trim();
    this.store.setItemPrice(index, raw === '' ? null : parseDecimal(raw));
  }

  addManual(): void {
    const name = this.newItemName.trim();
    if (!name) return;
    this.store.addItem({
      name,
      // Leer, ungültig oder ≤ 0 = „ohne Menge“.
      amount: Math.max(0, parseDecimal(this.newItemAmountText) ?? 0),
      unit: this.newItemUnit || 'g',
      checked: false,
    });
    this.newItemName = '';
    this.newItemAmountText = '';
    this.newItemUnit = 'g';
    void this.addNameInput()?.nativeElement.setFocus?.();
  }

  overBudget(): boolean {
    const l = this.list();
    return !!l && l.budget != null && this.totals().total > l.budget;
  }
}
