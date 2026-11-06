import { ChangeDetectionStrategy, Component, computed, input, signal } from '@angular/core';
import { FoodItem } from '../../core/models';

/**
 * Suchtreffer-Zeile (nur Darstellung, kein Klick-Handler; die Eltern-Zeile ist klickbar):
 * Vorschaubild, Name, Marke, "400 g · 539 kcal / 100 g" und Nutri-Score-Badge.
 */
@Component({
  selector: 'nt-food-row',
  templateUrl: './food-row.component.html',
  styleUrls: ['./food-row.component.scss'],
  standalone: false,
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class NtFoodRowComponent {
  readonly item = input.required<FoodItem>();

  /** Bild konnte nicht geladen werden -> neutrales Icon. */
  protected readonly imageFailed = signal(false);

  protected readonly meta = computed(() => {
    const it = this.item();
    const per100 = it.facts.basis === 'per100g' ? ' / 100 g' : '';
    const kcal = `${Math.round(it.facts.kcal)} kcal${per100}`;
    return it.quantity ? `${it.quantity} · ${kcal}` : kcal;
  });

  protected readonly scoreLabel = computed(() => {
    const s = this.item().nutriscore;
    return s ? `Nutri-Score ${s.toUpperCase()}` : null;
  });
}
