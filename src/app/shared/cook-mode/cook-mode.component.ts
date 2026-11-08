import { ChangeDetectionStrategy, Component, computed, input, output, signal } from '@angular/core';

/** Zutat in der Kochansicht (Menge bereits skaliert). */
export interface CookIngredient {
  name: string;
  amount: number;
  unit: string;
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

  protected amountText(amount: number, unit: string): string {
    const n = amount > 0 ? String(amount).replace('.', ',') : '';
    return [n, unit].filter(Boolean).join(' ');
  }
}
