import {
  ChangeDetectionStrategy, ChangeDetectorRef, Component, ViewChild, inject, input, output, signal,
} from '@angular/core';
import { FoodItem } from '../../core/models';
import { FOOD_PROVIDER } from '../../core/food/food-provider';
import { DiarySearch } from '../../diary/diary-search';

/**
 * Lebensmittelsuche (Suchfeld mit Entprellung, Mindestlänge-Hinweis, Ladezustand,
 * Trefferliste aus `nt-food-row`, „Manuell eintragen“ ohne Treffer, Enter wählt den
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

  readonly placeholder = input('Lebensmittel suchen…');
  /** „Manuell eintragen“ bei leerer Trefferliste anbieten. */
  readonly allowManual = input(true);
  /** Ein Treffer wurde gewählt (Klick oder Enter). */
  readonly picked = output<FoodItem>();
  /** „Manuell eintragen“ gewählt; Wert = aktueller Suchbegriff. */
  readonly manualEntry = output<string>();

  protected readonly error = signal<string | null>(null);
  readonly search = new DiarySearch(inject(FOOD_PROVIDER), (message) => this.error.set(message));

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
