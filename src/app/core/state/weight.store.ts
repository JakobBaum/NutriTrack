import { Injectable, computed, inject, signal } from '@angular/core';
import { StorageService } from '../storage/storage.service';
import { isValidWeight, removeWeight, upsertWeight, WeightEntry } from '../weight/weight-math';

export const KEY_WEIGHT = 'weight';
const ISO_DAY = /^\d{4}-\d{2}-\d{2}$/;

/** Nur Einträge mit gültigem Tag und Gewicht, höchstens einer je Tag, nach Datum sortiert. */
export function sanitizeWeights(raw: unknown): readonly WeightEntry[] {
  if (!Array.isArray(raw)) return [];
  return raw.reduce<readonly WeightEntry[]>((list, item) => {
    const e = item as Partial<WeightEntry> | null;
    const ok = !!e && typeof e.dateISO === 'string' && ISO_DAY.test(e.dateISO) && isValidWeight(e.kg);
    return ok ? upsertWeight(list, { dateISO: e.dateISO as string, kg: e.kg as number }) : list;
  }, []);
}

/**
 * Gewichtsverlauf: ein Eintrag je Tag (20 bis 400 kg), unveränderliche Liste,
 * lokal über den StorageService gespeichert.
 */
@Injectable({ providedIn: 'root' })
export class WeightStore {
  private readonly storage = inject(StorageService);

  private readonly _entries = signal<readonly WeightEntry[]>(sanitizeWeights(this.storage.get<unknown>(KEY_WEIGHT, [])));

  /** Alle Einträge, älteste zuerst. */
  readonly entries = this._entries.asReadonly();

  /** Letzter Eintrag oder null. */
  readonly latest = computed<WeightEntry | null>(() => {
    const list = this._entries();
    return list.length > 0 ? list[list.length - 1] : null;
  });

  /** Trägt das Gewicht eines Tages ein (ersetzt den Eintrag des Tages). Liefert false bei ungültigen Werten. */
  set(dateISO: string, kg: number): boolean {
    const next = upsertWeight(this._entries(), { dateISO, kg });
    if (next === this._entries()) return false;
    this._entries.set(next);
    this.persist();
    return true;
  }

  remove(dateISO: string): void {
    this._entries.update((list) => removeWeight(list, dateISO));
    this.persist();
  }

  /** Löscht alle Einträge (für "Daten zurücksetzen"). */
  clear(): void {
    this._entries.set([]);
    this.storage.remove(KEY_WEIGHT);
  }

  private persist(): void {
    this.storage.set(KEY_WEIGHT, this._entries());
  }
}
