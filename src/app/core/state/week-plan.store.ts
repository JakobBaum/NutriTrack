import { Injectable, inject, signal } from '@angular/core';
import { StorageService } from '../storage/storage.service';
import { WeekPlan } from '../week-plan/week-plan.model';
import { sanitizeBlocked, sanitizeWeekPlan } from './week-plan-sanitize';

const KEY_WEEK_PLAN = 'week-plan';
const KEY_BLOCKED = 'week-plan-blocked';

/** Aktueller Wochenplan (Online-Rezepte); lokal persistiert. */
@Injectable({ providedIn: 'root' })
export class WeekPlanStore {
  private readonly storage = inject(StorageService);

  private readonly _plan = signal<WeekPlan | null>(this.loadPlan());

  private readonly _blocked = signal<readonly string[]>(sanitizeBlocked(this.storage.get<unknown>(KEY_BLOCKED, [])));

  /** Aktueller Plan oder null. */
  readonly plan = this._plan.asReadonly();

  /** Rezept-Ids, die nie wieder vorgeschlagen werden ("Nie wieder vorschlagen"). */
  readonly blocked = this._blocked.asReadonly();

  /** Merkt Rezepte als "nie wieder vorschlagen" (ohne Duplikate). */
  block(ids: readonly string[]): void {
    const next = [...new Set([...this._blocked(), ...ids])];
    this._blocked.set(next);
    this.storage.set(KEY_BLOCKED, next);
  }

  set(plan: WeekPlan): void {
    this._plan.set(plan);
    this.storage.set(KEY_WEEK_PLAN, plan);
  }

  /** Liest den Plan und prüft ihn; ein unbrauchbarer Plan kommt in Quarantäne und wird entfernt. */
  private loadPlan(): WeekPlan | null {
    const stored = this.storage.get<unknown>(KEY_WEEK_PLAN, null);
    if (stored === null) return null;
    const clean = sanitizeWeekPlan(stored);
    if (clean === null) {
      this.storage.quarantine(KEY_WEEK_PLAN, [stored], 'invalid');
      this.storage.remove(KEY_WEEK_PLAN);
    }
    return clean;
  }

  /** Verwirft den Plan (auch für "Daten zurücksetzen"). */
  clear(): void {
    this._plan.set(null);
    this._blocked.set([]);
    this.storage.remove(KEY_WEEK_PLAN);
    this.storage.remove(KEY_BLOCKED);
  }
}
