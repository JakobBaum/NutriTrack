import { Injectable, inject, signal } from '@angular/core';
import { ShoppingItem, ShoppingList } from '../models';
import { StorageService } from '../storage/storage.service';
import { buildShoppingList } from '../shopping/shopping-generator';
import { makeId } from '../util/id';
import { RecipeStore } from './recipe.store';

const KEY_LIST = 'shopping';

/**
 * Verwaltet die aktuelle Einkaufsliste. Generierung läuft lokal über
 * {@link buildShoppingList} (Fallback) aus den vorhandenen Rezepten;
 * später kann der AiProvider die Generierung übernehmen.
 */
@Injectable({ providedIn: 'root' })
export class ShoppingStore {
  private readonly storage = inject(StorageService);
  private readonly recipes = inject(RecipeStore);

  private readonly _list = signal<ShoppingList | null>(
    this.storage.get<ShoppingList | null>(KEY_LIST, null),
  );

  /** Aktuelle Einkaufsliste (oder null). */
  readonly list = this._list.asReadonly();

  /** Generiert eine neue Liste aus Gerichte-/Personenanzahl. */
  generate(dishes: number, persons: number): ShoppingList {
    const { items, suggestedDishes } = buildShoppingList(
      this.recipes.recipes(),
      dishes,
      persons,
    );
    const list: ShoppingList = {
      id: makeId('shopping'),
      dishes: Math.max(1, Math.floor(dishes)),
      persons: Math.max(1, Math.floor(persons)),
      items,
      suggestedDishes,
      generatedAt: new Date().toISOString(),
    };
    this._list.set(list);
    this.persist();
    return list;
  }

  /** Hakt eine Position ab bzw. hebt die Markierung auf. */
  toggleItem(index: number): void {
    this._list.update((l) => {
      if (!l) return l;
      const items = l.items.map((it, i) =>
        i === index ? { ...it, checked: !it.checked } : it,
      );
      return { ...l, items };
    });
    this.persist();
  }

  /** Fügt eine manuelle Position hinzu. */
  addItem(item: ShoppingItem): void {
    this._list.update((l) => {
      const base: ShoppingList =
        l ?? {
          id: makeId('shopping'),
          dishes: 0,
          persons: 1,
          items: [],
          suggestedDishes: [],
          generatedAt: new Date().toISOString(),
        };
      return { ...base, items: [...base.items, item] };
    });
    this.persist();
  }

  /** Entfernt eine Position. */
  removeItem(index: number): void {
    this._list.update((l) =>
      l ? { ...l, items: l.items.filter((_, i) => i !== index) } : l,
    );
    this.persist();
  }

  /** Löscht die Liste (für "Daten zurücksetzen"). */
  clear(): void {
    this._list.set(null);
    this.storage.remove(KEY_LIST);
  }

  private persist(): void {
    this.storage.set(KEY_LIST, this._list());
  }
}
