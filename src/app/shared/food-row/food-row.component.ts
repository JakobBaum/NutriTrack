import { ChangeDetectionStrategy, Component, computed, input } from '@angular/core';
import { FoodItem } from '../../core/models';
import { isCustomFoodItem } from '../../core/food/custom-food-search';

/**
 * Suchtreffer-Zeile (nur Darstellung, kein Klick-Handler; die Eltern-Zeile ist klickbar), ohne Bild:
 * Name (fett), darunter „Marke · Packungsgröße“ (bei eigenen Lebensmitteln mit der Textmarke „Eigen“),
 * danach „539 kcal · 6 g Eiweiß / 100 g“ und rechts der Nutri-Score als kleine Textmarke.
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

  protected readonly isCustom = computed(() => isCustomFoodItem(this.item()));

  /** „Marke · Packungsgröße“; leer, wenn beides fehlt. */
  protected readonly subline = computed(() => {
    const it = this.item();
    return [it.brand, it.quantity].filter((part): part is string => !!part).join(' · ');
  });

  protected readonly kcalText = computed(() => `${Math.round(this.item().facts.kcal)} kcal`);

  /** Eiweiß je Basis, hervorgehoben (Eiweiß-Farbe, halbfett); leer, wenn der Wert fehlt. */
  protected readonly proteinText = computed(() => {
    const protein = this.item().facts.proteinG;
    return Number.isFinite(protein) ? `${Math.round(protein)} g Eiweiß` : '';
  });

  protected readonly baseText = computed(() => (this.item().facts.basis === 'per100g' ? ' / 100 g' : ' / Portion'));

  protected readonly scoreLabel = computed(() => {
    const s = this.item().nutriscore;
    return s ? `Nutri-Score ${s.toUpperCase()}` : null;
  });
}
