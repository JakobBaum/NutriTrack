import { Injectable, inject, signal } from '@angular/core';
import { MealType, ShoppingItem, ShoppingList } from '../models';
import { AiService } from '../ai/ai.service';
import { MockAiProvider } from '../ai/mock-ai-provider';
import { StorageService } from '../storage/storage.service';
import { withCategories, withCategory } from '../shopping/shopping-category';
import { fillMissingPrices } from '../shopping/ingredient-price';
import { assertCurrent } from '../shopping/generation-cancelled';
import { roundItemsToPackages } from '../shopping/package-size';
import { buildShoppingList } from '../shopping/shopping-generator';
import { makeId } from '../util/id';
import { WeekPlan } from '../week-plan/week-plan.model';
import { weekPlanToRecipes } from '../week-plan/week-plan-recipes';
import { OnlineRecipeDetailsService } from '../recipes/online/online-recipe-details.service';
import { RecipeStore } from './recipe.store';
import { assignIds, mergeKept, mergeSameGoods, repriced } from './shopping-merge';
import { skippedNote, splitOutcomes } from './shopping-resolve';
import { ensureItemIds, sanitizeShoppingList } from './shopping-sanitize';

/** Optionen für den Wocheneinkauf. */
export interface ShoppingPlanOptions {
  persons: number;
  days: number;
  meals: MealType[];
  budget?: number;
  store?: string;
  /** Liefert false, sobald die Anfrage abgebrochen wurde; das Ergebnis wird dann verworfen. */
  isCurrent?: () => boolean;
}

/** Einkaufsliste inkl. Zusatzfeldern, die das Basismodell nicht kennt. */
export interface ShoppingListView extends ShoppingList {
  /** Hinweis des Anbieters (z. B. "über Budget"). */
  note?: string;
  /** Hinweis, der bis zum nächsten Erzeugen bleibt (z. B. nicht geladene Rezepte). */
  notice?: string;
  /** Modus bei der Generierung: 'ai' = mit KI-Verbindung (Preise), 'mock' = ohne KI (nur Mengen). */
  priceSource?: 'mock' | 'ai';
}

const KEY_LIST = 'shopping';

/** Ganze Zahl >= 1; ungültige Angaben (NaN, Infinity) zählen als 1. */
const toCount = (n: number): number => (Number.isFinite(n) ? Math.max(1, Math.floor(n)) : 1);

/** Angezeigter Preis einer Position: eigener Preis vor Schätzung; undefined, wenn keiner da ist. */
export function itemPrice(it: ShoppingItem): number | undefined {
  const p = it.userPrice ?? it.estPrice;
  return typeof p === 'number' && Number.isFinite(p) ? p : undefined;
}

/** Summe der Preise (eigener Preis vor Schätzung); `unpriced` zählt Positionen ohne Preis. */
export function sumItems(items: readonly ShoppingItem[]): { total: number; unpriced: number } {
  let total = 0;
  let unpriced = 0;
  for (const it of items) {
    const p = itemPrice(it);
    if (p === undefined) unpriced += 1;
    else total += p;
  }
  return { total: Math.round(total * 100) / 100, unpriced };
}

/** Rundet erzeugte Positionen auf Packungen, fasst gleiche Ware danach zusammen und kategorisiert sie. */
function prepareGenerated(items: readonly ShoppingItem[]): ShoppingItem[] {
  const packed = mergeSameGoods(roundItemsToPackages(items));
  return fillMissingPrices(withCategories(packed).map((it) => ({ ...it, manual: false })));
}

export { mergeKept };

/** Hält estTotal an die Positionen gekoppelt; ein Hinweis zur alten Summe (z. B. Budget) entfällt bei Änderung. */
function withTotal(l: ShoppingListView): ShoppingListView {
  const estTotal = sumItems(l.items).total;
  const stale = estTotal !== l.estTotal;
  return { ...l, estTotal, note: stale ? undefined : l.note };
}

/**
 * Verwaltet die aktuelle Einkaufsliste. Generierung läuft lokal über
 * {@link buildShoppingList} (Fallback) aus den vorhandenen Rezepten;
 * später kann der AiProvider die Generierung übernehmen.
 */
@Injectable({ providedIn: 'root' })
export class ShoppingStore {
  private readonly storage = inject(StorageService);
  /** True, wenn Schreiben gesperrt ist (neueres Schema oder Änderung in anderem Fenster); Änderungen werden dann nicht gespeichert. */
  readonly isReadOnly = this.storage.isLockedFor(KEY_LIST);
  private readonly recipes = inject(RecipeStore);
  private readonly ai = inject(AiService);
  private readonly mock = inject(MockAiProvider);
  private readonly onlineDetails = inject(OnlineRecipeDetailsService);

  private readonly _list = signal<ShoppingListView | null>(this.loadList());

  /** Aktuelle Einkaufsliste (oder null). */
  readonly list = this._list.asReadonly();

  /**
   * Generiert einen Wocheneinkauf über den KI-Anbieter (Mock oder Claude),
   * inkl. Schätzpreisen. Abgehakte und manuelle Positionen der bisherigen
   * Liste bleiben erhalten. Persistiert das Ergebnis.
   */
  async generatePlan(opts: ShoppingPlanOptions): Promise<ShoppingListView> {
    const live = this.ai.isLive();
    if (!live && this.recipes.recipes().length === 0) {
      throw new Error('Lege zuerst Rezepte an, daraus entsteht die Einkaufsliste.');
    }
    // Die KI bekommt nur Titel. Ohne KI braucht der lokale Plan Zutaten: Online-Verweise vorher nachladen.
    const { recipes: planRecipes, skipped } = live
      ? { recipes: this.recipes.recipes(), skipped: [] as string[] }
      : splitOutcomes(await this.onlineDetails.resolveAll(this.recipes.recipes()));
    assertCurrent(opts.isCurrent);
    if (!live && planRecipes.length === 0) throw new Error(skippedNote(skipped) ?? 'Keine Rezepte für die Einkaufsliste.');
    // Budget und Markt wirken nur mit Preisen, also nur mit KI-Verbindung.
    const budget = live ? opts.budget : undefined;
    const storeName = live ? opts.store : undefined;
    const persons = toCount(opts.persons);
    const days = toCount(opts.days);
    const req = {
      persons,
      days,
      meals: opts.meals,
      budget,
      store: storeName,
      recipes: [...planRecipes],
    };
    const result = await this.ai.generateShoppingList(req).catch(async (err: unknown) => {
      if (live) {
        // Proxy/KI-Fehler → Mock-Fallback, Fehler an Aufrufer weitergeben
        throw err;
      }
      return this.mock.generateShoppingList(req);
    });
    assertCurrent(opts.isCurrent);
    // Immer schätzen (Tabelle, ohne KI); vorhandene KI-Preise bleiben.
    const priced = prepareGenerated(result.items);
    const previous = this._list()?.items ?? [];
    const items = assignIds(previous, withCategories(mergeKept(previous, priced)));
    const list: ShoppingListView = {
      id: makeId('shopping'),
      dishes: days * Math.max(1, opts.meals.length),
      persons,
      days,
      meals: opts.meals,
      budget,
      store: storeName,
      items,
      suggestedDishes: result.suggestedDishes,
      estTotal: sumItems(items).total,
      note: result.note,
      notice: skippedNote(skipped),
      priceSource: live ? 'ai' : 'mock',
      generatedAt: new Date().toISOString(),
    };
    this._list.set(list);
    this.persist();
    return list;
  }

  /**
   * Schreibt die Zutaten ALLER Wochenplan-Rezepte (auf `persons` skaliert, gleiche Name+Einheit
   * addiert) in die Liste. Standardmäßig bleiben abgehakte und manuelle Positionen erhalten;
   * mit `keepExisting = false` wird die bisherige Liste komplett ersetzt.
   */
  applyWeekPlan(plan: WeekPlan, keepExisting = true): ShoppingListView {
    const live = this.ai.isLive();
    const { items: raw, suggestedDishes } = buildShoppingList(weekPlanToRecipes(plan), plan.recipes.length, plan.persons);
    const priced = prepareGenerated(raw);
    const previous = this._list()?.items ?? [];
    const items = assignIds(previous, withCategories(mergeKept(keepExisting ? previous : [], priced)));
    const list: ShoppingListView = {
      id: makeId('shopping'),
      dishes: plan.recipes.length,
      persons: plan.persons,
      days: plan.days,
      meals: plan.meals,
      items,
      suggestedDishes,
      estTotal: sumItems(items).total,
      priceSource: live ? 'ai' : 'mock',
      generatedAt: new Date().toISOString(),
    };
    this._list.set(list);
    this.persist();
    return list;
  }

  /** Hakt die Position mit dieser id ab bzw. hebt die Markierung auf. */
  toggleItem(id: string): void {
    this.updateItem(id, (it) => ({ ...it, checked: !it.checked }));
  }

  /** Setzt oder löscht (null) den vom Nutzer eingetragenen Preis der Position mit dieser id. */
  setItemPrice(id: string, price: number | null): void {
    const valid = price !== null && Number.isFinite(price) && price >= 0;
    this.updateItem(id, (it) => {
      const { userPrice: _drop, ...rest } = it;
      return valid ? { ...rest, userPrice: Math.round((price as number) * 100) / 100 } : rest;
    });
  }

  /** Fügt eine manuelle Position hinzu (bekommt eine neue id). */
  addItem(item: ShoppingItem): void {
    this._list.update((l) => {
      const base: ShoppingListView =
        l ?? {
          id: makeId('shopping'),
          dishes: 0,
          persons: 1,
          items: [],
          suggestedDishes: [],
          generatedAt: new Date().toISOString(),
        };
      const added = repriced(withCategory({ ...item, id: undefined, manual: item.manual ?? true }));
      return withTotal({ ...base, items: ensureItemIds([...base.items, added]) });
    });
    this.persist();
  }

  /** Entfernt die Position mit dieser id. */
  removeItem(id: string): void {
    this.removeItems([id]);
  }

  /** Entfernt mehrere Positionen (nach id) in einem Schritt. */
  removeItems(ids: readonly string[]): void {
    const gone = new Set(ids);
    this._list.update((l) =>
      l && l.items.some((it) => it.id !== undefined && gone.has(it.id))
        ? withTotal({ ...l, items: l.items.filter((it) => it.id === undefined || !gone.has(it.id)) })
        : l,
    );
    this.persist();
  }

  private updateItem(id: string, change: (it: ShoppingItem) => ShoppingItem): void {
    this._list.update((l) => {
      if (!l || !l.items.some((it) => it.id === id)) return l;
      return withTotal({ ...l, items: l.items.map((it) => (it.id === id ? change(it) : it)) });
    });
    this.persist();
  }

  /** Löscht die Liste (für "Daten zurücksetzen"). */
  clear(): void {
    this._list.set(null);
    this.storage.remove(KEY_LIST);
  }

  /** Liest die Liste und prüft sie wie beim Import; Defektes kommt in Quarantäne (Original bleibt, bis die Sicherung gelang). */
  private loadList(): ShoppingListView | null {
    const raw = this.storage.get<unknown>(KEY_LIST, null);
    const { list, rejected, hasNewIds } = sanitizeShoppingList<ShoppingListView>(raw);
    if (rejected.length === 0) {
      // Neu vergebene ids einmal speichern (bei Schreibsperre lehnt set ab), damit sie beim nächsten Laden stabil bleiben.
      if (list !== null && hasNewIds) this.storage.set(KEY_LIST, list);
      return list;
    }
    if (this.storage.quarantine(KEY_LIST, rejected, 'invalid')) {
      if (list === null) this.storage.remove(KEY_LIST);
      else this.storage.set(KEY_LIST, list);
    }
    return list;
  }

  private persist(): boolean {
    return this.storage.set(KEY_LIST, this._list());
  }
}
