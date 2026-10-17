import { Injectable, inject, signal } from '@angular/core';
import { MealType, NutritionFacts, SavedMeal, SavedMealEntry } from '../models';
import { StorageService } from '../storage/storage.service';
import { makeId } from '../util/id';

const KEY = 'savedMeals';

export interface SavedMealDraft {
  name: string;
  entries: SavedMealEntry[];
}

@Injectable({ providedIn: 'root' })
export class MealsStore {
  private readonly storage = inject(StorageService);
  private readonly _meals = signal<SavedMeal[]>(this.storage.get<SavedMeal[]>(KEY, []));

  readonly meals = this._meals.asReadonly();

  add(draft: SavedMealDraft): SavedMeal {
    const meal: SavedMeal = {
      id: makeId('smeal'),
      name: draft.name.trim() || 'Mahlzeit',
      entries: draft.entries,
      createdAt: new Date().toISOString(),
    };
    this._meals.update(list => [...list, meal]);
    this.persist();
    return meal;
  }

  remove(id: string): void {
    this._meals.update(list => list.filter(m => m.id !== id));
    this.persist();
  }

  totalKcal(meal: SavedMeal): number {
    return Math.round(meal.entries.reduce((s, e) => s + e.facts.kcal, 0));
  }

  clear(): void {
    this._meals.set([]);
    this.persist();
  }

  private persist(): void {
    this.storage.set(KEY, this._meals());
  }
}
