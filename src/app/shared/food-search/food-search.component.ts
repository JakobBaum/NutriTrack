import {
  ChangeDetectionStrategy, ChangeDetectorRef, Component, ViewChild, computed, inject, input, output, signal,
} from '@angular/core';
import { FoodItem } from '../../core/models';
import { FOOD_PROVIDER } from '../../core/food/food-provider';
import { CustomFoodStore } from '../../core/state/custom-food.store';
import { withCustomFoods } from '../../core/food/combined-food-search';
import { isCustomFoodItem, recentCustomFoods } from '../../core/food/custom-food-search';
import { DiarySearch } from '../../diary/diary-search';

/**
 * Lebensmittelsuche (Suchfeld mit Entprellung, Mindestlänge-Hinweis, Ladezustand,
 * Trefferliste aus `nt-food-row` ohne Bilder, eigene Lebensmittel (CustomFoodStore) vor den Open-Food-Facts-Treffern, „Manuell eintragen“ ohne Treffer, Enter wählt den
 * ersten Treffer). Gemeinsam genutzt vom Tagebuch-Add-Sheet und den Mahlzeiten.
 * Inhalt (`ng-content`) erscheint zwischen Suchfeld und Trefferliste.
 */
@Component({
  selector: 'nt-food-search',
  templateUrl: './food-search.component.html',
  styleUrls: ['./food-search.component.scss'],
  standalone: false,
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class NtFoodSearchComponent {
  private readonly cdr = inject(ChangeDetectorRef);
  private readonly customFoods = inject(CustomFoodStore);

  readonly placeholder = input('Lebensmittel suchen…');
  /** „Manuell eintragen“ bei leerer Trefferliste anbieten. */
  readonly allowManual = input(true);
  /** Ohne Suchbegriff die zuletzt genutzten eigenen Lebensmittel anzeigen. */
  readonly showRecentCustom = input(false);
  /** Ein Treffer wurde gewählt (Klick oder Enter). */
  readonly picked = output<FoodItem>();
  /** „Manuell eintragen“ gewählt; Wert = aktueller Suchbegriff. */
  readonly manualEntry = output<string>();

  protected readonly error = signal<string | null>(null);
  readonly search = new DiarySearch(
    withCustomFoods(inject(FOOD_PROVIDER), () => this.customFoods.foods()),
    (message) => this.error.set(message),
  );

  protected readonly recentCustom = computed(() => recentCustomFoods(this.customFoods.foods()));

  /** Der Datenquellen-Credit (ODbL) gilt nur, wenn Treffer von Open Food Facts dabei sind. */
  protected hasOnlineResults(): boolean {
    return this.search.results().some((item) => !isCustomFoodItem(item));
  }

  @ViewChild('searchbar') private searchbar?: { setFocus(): Promise<void> };

  get query(): string {
    return this.search.query;
  }

  focus(): void {
    void this.searchbar?.setFocus();
  }

  reset(): void {
    this.search.reset();
    this.error.set(null);
    this.cdr.markForCheck();
  }

  protected pick(item: FoodItem): void {
    this.picked.emit(item);
    this.search.clearAfterPick();
    this.cdr.markForCheck();
  }

  protected async pickFirst(): Promise<void> {
    const first = await this.search.pickFirst();
    if (first) this.pick(first);
  }
}
