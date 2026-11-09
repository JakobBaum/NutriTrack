import { ChangeDetectionStrategy, Component, computed, inject, input, output, signal } from '@angular/core';
import { AppSettingsStore } from '../../core/state/app-settings.store';
import { formatQuantity } from '../../core/shopping/units/unit-format';
import { convertStepText } from '../../core/shopping/units/unit-text';

/** Zutat in der Kochansicht (Menge bereits skaliert). */
export interface CookIngredient {
  name: string;
  amount: number;
  unit: string;
  /** Umrechnung nur ungefähr. */
  approx?: boolean;
}

/**
 * Kochmodus (Vollbild): Schritt für Schritt mit Fortschritt. Mit `ingredients` steht vorn eine
 * Seite „Zutaten“. Genutzt von der Rezeptseite und vom Wochenplan.
 */
@Component({
  selector: 'nt-cook-mode',
  templateUrl: './cook-mode.component.html',
  styleUrls: ['./cook-mode.component.scss'],
  standalone: false,
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class NtCookModeComponent {
  private readonly settings = inject(AppSettingsStore);

  readonly open = input(false);
  readonly title = input('');
  readonly steps = input<readonly string[]>([]);
  readonly ingredients = input<readonly CookIngredient[]>([]);

  /** Wird gesendet, wenn der Modus beendet oder weggewischt wird. */
  readonly dismissed = output<void>();

  protected readonly page = signal(0);
  protected readonly hasIngredients = computed(() => this.ingredients().length > 0);
  protected readonly total = computed(() => this.steps().length + (this.hasIngredients() ? 1 : 0));
  protected readonly isLast = computed(() => this.page() >= this.total() - 1);
  /** Schrittindex der aktuellen Seite; -1 = Zutatenseite. */
  protected readonly stepIndex = computed(() => this.page() - (this.hasIngredients() ? 1 : 0));
  protected readonly progress = computed(() => (this.total() > 0 ? ((this.page() + 1) / this.total()) * 100 : 0));

  protected next(): void {
    this.page.update((p) => Math.min(p + 1, this.total() - 1));
  }

  protected prev(): void {
    this.page.update((p) => Math.max(p - 1, 0));
  }

  protected close(): void {
    this.page.set(0);
    this.dismissed.emit();
  }

  /** Menge im gewählten Einheitensystem (g/kg/ml/l oder lb/oz/cups). */
  protected ingredientAmount(ing: CookIngredient): string {
    if (!(ing.amount > 0)) return ing.unit;
    return (ing.approx ? 'ca. ' : '') + formatQuantity(ing.amount, ing.unit, ing.name, this.settings.unitSystem());
  }

  /** Schritttext mit Temperaturen und Längen im gewählten System. */
  protected stepText(step: string | undefined): string {
    return convertStepText(step ?? '', this.settings.unitSystem());
  }
}
