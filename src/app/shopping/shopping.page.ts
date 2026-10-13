import { ChangeDetectionStrategy, Component, inject, signal } from '@angular/core';
import { ShoppingStore } from '../core/state/shopping.store';

/**
 * Einkaufsliste: generiert eine Liste aus #Gerichte + #Personen (lokal aus den
 * vorhandenen Rezepten, sonst Basis-Liste) und erlaubt Abhaken/Ergänzen.
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

  dishes = 3;
  persons = 2;

  newItemName = '';
  newItemAmount: number | null = null;
  newItemUnit = 'g';

  generate(): void {
    this.store.generate(this.dishes, this.persons);
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
}
