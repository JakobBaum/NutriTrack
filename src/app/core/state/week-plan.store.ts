import { Injectable, inject, signal } from '@angular/core';
import { StorageService } from '../storage/storage.service';
import { WeekPlan } from '../week-plan/week-plan.model';

const KEY_WEEK_PLAN = 'week-plan';

/** Aktueller Wochenplan (Online-Rezepte); lokal persistiert. */
@Injectable({ providedIn: 'root' })
export class WeekPlanStore {
  private readonly storage = inject(StorageService);

  private readonly _plan = signal<WeekPlan | null>(this.storage.get<WeekPlan | null>(KEY_WEEK_PLAN, null));

  /** Aktueller Plan oder null. */
  readonly plan = this._plan.asReadonly();

  set(plan: WeekPlan): void {
    this._plan.set(plan);
    this.storage.set(KEY_WEEK_PLAN, plan);
  }

  /** Verwirft den Plan (auch für "Daten zurücksetzen"). */
  clear(): void {
    this._plan.set(null);
    this.storage.remove(KEY_WEEK_PLAN);
  }
}
