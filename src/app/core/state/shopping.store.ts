import { Injectable, inject, signal } from '@angular/core';
import { MealType, ShoppingItem, ShoppingList } from '../models';
import { AiService } from '../ai/ai.service';
import { MockAiProvider } from '../ai/mock-ai-provider';
import { StorageService } from '../storage/storage.service';
import { withCategories, withCategory } from '../shopping/shopping-category';
import { fillMissingPrices } from '../shopping/price-table';
import { roundItemsToPackages } from '../shopping/package-size';
import { buildShoppingList } from '../shopping/shopping-generator';
import { fromNormalized, itemKey, normalizeUnit } from '../shopping/shopping-units';
import { makeId } from '../util/id';
import { WeekPlan } from '../week-plan/week-plan.model';
import { weekPlanToRecipes } from '../week-plan/week-plan-recipes';
import { RecipeStore } from './recipe.store';

/** Optionen für den Wocheneinkauf. */
export interface ShoppingPlanOptions {
  persons: number;
  days: number;
  meals: MealType[];
  budget?: number;
  store?: string;
}

/** Einkaufsliste inkl. Zusatzfeldern, die das Basismodell nicht kennt. */
export interface ShoppingListView extends ShoppingList {
  /** Hinweis des Anbieters (z. B. "über Budget"). */
  note?: string;
  /** Modus bei der Generierung: 'ai' = mit KI-Verbindung (Preise), 'mock' = ohne KI (nur Mengen). */
  priceSource?: 'mock' | 'ai';
}

const KEY_LIST = 'shopping';

/** Summe der Schätzpreise; `unpriced` zählt Positionen ohne Preis. */
export function sumItems(items: readonly ShoppingItem[]): { total: number; unpriced: number } {
  let total = 0;
  let unpriced = 0;
  for (const it of items) {
    if (typeof it.estPrice === 'number' && Number.isFinite(it.estPrice)) total += it.estPrice;
    else unpriced += 1;
  }
  return { total: Math.round(total * 100) / 100, unpriced };
}

const keyOf = (it: ShoppingItem): string => itemKey(it.name, it.unit);

const round2 = (n: number): number => Math.round(n * 100) / 100;

/** Menge einer Position in der Basiseinheit (g, ml, Stk, ...), damit g/kg usw. vergleichbar sind. */
const baseAmount = (it: ShoppingItem): number => normalizeUnit(it.amount, it.unit).amount;

/** Preise zweier Positionen addieren; fehlt einer, zählt der vorhandene. */
function sumPrice(a?: number, b?: number): number | undefined {
  if (a == null) return b;
  if (b == null) return a;
  return round2(a + b);
}

/** Fasst mehrere behaltene Positionen derselben Ware (Name + Einheitenfamilie) zu einer zusammen. */
function collapseDuplicates(items: readonly ShoppingItem[]): ShoppingItem[] {
  const byKey = new Map<string, ShoppingItem>();
  for (const it of items) {
    const key = keyOf(it);
    const first = byKey.get(key);
    if (!first) {
      byKey.set(key, it);
      continue;
    }
    const amount = round2(first.amount + fromNormalized(baseAmount(it), first.unit));
    byKey.set(key, {
      ...first,
      amount,
      checked: first.checked && it.checked,
      estPrice: sumPrice(first.estPrice, it.estPrice),
      category: first.category ?? it.category,
    });
  }
  return [...byKey.values()];
}

/**
 * Führt eine behaltene Position mit der generierten gleichen Ware zusammen: Es gilt die größere
 * Menge (Einheit der behaltenen Position); wächst der Bedarf, wird die Position wieder offen.
 */
function mergeOne(old: ShoppingItem, g: ShoppingItem): ShoppingItem {
  const needBase = baseAmount(g);
  const grows = old.amount <= 0 || needBase > baseAmount(old);
  const amount = grows ? round2(fromNormalized(needBase, old.unit)) : old.amount;
  const category = old.category ?? g.category;
  const checked = grows ? false : old.checked;
  if (old.estPrice != null) {
    const scaled = grows && old.amount > 0 ? round2((old.estPrice * amount) / old.amount) : old.estPrice;
    return { ...old, amount, category, checked, estPrice: scaled };
  }
  // Ohne eigenen Preis den generierten übernehmen, auf die Menge skaliert.
  const gAmount = fromNormalized(needBase, old.unit);
  const estPrice = g.estPrice != null && gAmount > 0 ? round2((g.estPrice * amount) / gAmount) : g.estPrice;
  return { ...old, amount, category, checked, estPrice };
}

/**
 * Übernimmt beim Neu-Generieren abgehakte und manuelle Positionen (manuell =
 * Markierung `manual` oder ohne Schätzpreis). Gleiche Ware (Name + Einheitenfamilie)
 * ersetzt die neu generierte Position; die größere Menge gewinnt, mehrere manuelle Duplikate werden addiert.
 */
export function mergeKept(
  previous: readonly ShoppingItem[],
  generated: readonly ShoppingItem[],
): ShoppingItem[] {
  // `manual: false` markiert generierte Positionen: ohne Preis trotzdem ersetzbar.
  const kept = collapseDuplicates(
    previous.filter((it) => it.checked || it.manual === true || (it.estPrice == null && it.manual !== false)),
  );
  const byKey = new Map(kept.map((it) => [keyOf(it), it] as const));
  const used = new Set<string>();
  const merged = generated.map((g) => {
    const key = keyOf(g);
    const old = byKey.get(key);
    if (!old || used.has(key)) return g;
    used.add(key);
    return mergeOne(old, g);
  });
  const rest = kept.filter((it) => !used.has(keyOf(it)));
  return [...merged, ...rest];
}

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
  private readonly recipes = inject(RecipeStore);
  private readonly ai = inject(AiService);
  private readonly mock = inject(MockAiProvider);

  private readonly _list = signal<ShoppingListView | null>(
    this.storage.get<ShoppingListView | null>(KEY_LIST, null),
  );

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
    // Budget und Markt wirken nur mit Preisen, also nur mit KI-Verbindung.
    const budget = live ? opts.budget : undefined;
    const storeName = live ? opts.store : undefined;
    const req = {
      persons: opts.persons,
      days: opts.days,
      meals: opts.meals,
      budget,
      store: storeName,
      recipes: this.recipes.recipes(),
    };
    const result = await this.ai.generateShoppingList(req).catch(async (err: unknown) => {
      if (live) {
        // Proxy/KI-Fehler → Mock-Fallback, Fehler an Aufrufer weitergeben
        throw err;
      }
      return this.mock.generateShoppingList(req);
    });
    const generated = withCategories(roundItemsToPackages(result.items)).map((it) => ({ ...it, manual: false }));
    // Ohne KI keine Preise; mit KI fehlende Preise über die Kategorie-Tabelle ergänzen.
    const priced = live ? fillMissingPrices(generated) : generated;
    const items = withCategories(mergeKept(this._list()?.items ?? [], priced));
    const list: ShoppingListView = {
      id: makeId('shopping'),
      dishes: Math.max(1, Math.floor(opts.days)) * Math.max(1, opts.meals.length),
      persons: Math.max(1, Math.floor(opts.persons)),
      days: Math.max(1, Math.floor(opts.days)),
      meals: opts.meals,
      budget,
      store: storeName,
      items,
      suggestedDishes: result.suggestedDishes,
      estTotal: sumItems(items).total,
      note: result.note,
      priceSource: live ? 'ai' : 'mock',
      generatedAt: new Date().toISOString(),
    };
    this._list.set(list);
    this.persist();
    return list;
  }

  /**
   * Schreibt die Zutaten ALLER Wochenplan-Rezepte (auf `persons` skaliert, gleiche Name+Einheit
   * addiert) in die Liste. Abgehakte und manuelle Positionen bleiben erhalten.
   */
  applyWeekPlan(plan: WeekPlan): ShoppingListView {
    const live = this.ai.isLive();
    const { items: raw, suggestedDishes } = buildShoppingList(weekPlanToRecipes(plan), plan.recipes.length, plan.persons);
    const generated = withCategories(roundItemsToPackages(raw)).map((it) => ({ ...it, manual: false }));
    const priced = live ? fillMissingPrices(generated) : generated;
    const items = withCategories(mergeKept(this._list()?.items ?? [], priced));
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

  /** Hakt eine Position ab bzw. hebt die Markierung auf. */
  toggleItem(index: number): void {
    this._list.update((l) => {
      if (!l) return l;
      const items = l.items.map((it, i) =>
        i === index ? { ...it, checked: !it.checked } : it,
      );
      return withTotal({ ...l, items });
    });
    this.persist();
  }

  /** Setzt oder löscht (null) den vom Nutzer eingetragenen Preis einer Position. */
  setItemPrice(index: number, price: number | null): void {
    const valid = price !== null && Number.isFinite(price) && price >= 0;
    this._list.update((l) => {
      if (!l || index < 0 || index >= l.items.length) return l;
      const items = l.items.map((it, i) => {
        if (i !== index) return it;
        const { estPrice: _drop, ...rest } = it;
        return valid ? { ...rest, estPrice: Math.round((price as number) * 100) / 100 } : rest;
      });
      return withTotal({ ...l, items });
    });
    this.persist();
  }

  /** Fügt eine manuelle Position hinzu. */
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
      return withTotal({ ...base, items: [...base.items, withCategory({ ...item, manual: item.manual ?? true })] });
    });
    this.persist();
  }

  /** Entfernt eine Position. */
  removeItem(index: number): void {
    this._list.update((l) =>
      l ? withTotal({ ...l, items: l.items.filter((_, i) => i !== index) }) : l,
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
