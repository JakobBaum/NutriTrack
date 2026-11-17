import { Injectable, computed, inject, signal } from '@angular/core';
import { StorageService } from '../storage/storage.service';
import { isValidWeight, removeWeight, upsertWeight, WeightEntry } from '../weight/weight-math';
import { commitSignal } from './commit-signal';
import { sanitizeWeightEntries } from './weight-sanitize';

export const KEY_WEIGHT = 'weight';
const KEY_HINT = 'weightHintDismissedAtKg';

function readHintKg(raw: unknown): number | null {
  return isValidWeight(raw) ? raw : null;
}

/**
 * Gewichtsverlauf: ein Eintrag je Tag (20 bis 400 kg), unveränderliche Liste,
 * lokal über den StorageService gespeichert.
 */
@Injectable({ providedIn: 'root' })
export class WeightStore {
  private readonly storage = inject(StorageService);
  /** True, wenn Schreiben gesperrt ist (neueres Schema oder Änderung in anderem Fenster); Änderungen werden dann nicht gespeichert. */
  readonly isReadOnly = this.storage.isLockedFor(KEY_WEIGHT);

  private readonly _entries = signal<readonly WeightEntry[]>(
    this.storage.getSanitized<WeightEntry>(KEY_WEIGHT, sanitizeWeightEntries),
  );

  /** Alle Einträge, älteste zuerst. */
  readonly entries = this._entries.asReadonly();

  private readonly _hintDismissedAtKg = signal<number | null>(readHintKg(this.storage.get<unknown>(KEY_HINT, null)));

  /** Gewicht, bei dem der Hinweis „Ziel neu berechnen“ ausgeblendet wurde (null = nie). */
  readonly driftHintDismissedAtKg = this._hintDismissedAtKg.asReadonly();

  /** Letzter Eintrag oder null. */
  readonly latest = computed<WeightEntry | null>(() => {
    const list = this._entries();
    return list.length > 0 ? list[list.length - 1] : null;
  });

  /** Trägt das Gewicht eines Tages ein (ersetzt den Eintrag des Tages). Liefert false bei ungültigen Werten oder wenn das Speichern scheitert. */
  set(dateISO: string, kg: number): boolean {
    const next = upsertWeight(this._entries(), { dateISO, kg });
    if (next === this._entries()) return false;
    return commitSignal(this._entries, next, () => this.persist());
  }

  /** Entfernt den Eintrag eines Tages; `false`, wenn das Speichern scheiterte (dann unverändert). */
  remove(dateISO: string): boolean {
    return commitSignal(this._entries, removeWeight(this._entries(), dateISO), () => this.persist());
  }

  /** Blendet den Hinweis „Ziel neu berechnen“ aus, bis sich das Gewicht erneut deutlich ändert. */
  dismissDriftHint(atKg: number): void {
    if (!isValidWeight(atKg)) return;
    this._hintDismissedAtKg.set(atKg);
    this.storage.set(KEY_HINT, atKg);
  }

  /** Löscht alle Einträge (für "Daten zurücksetzen"). */
  clear(): void {
    this._entries.set([]);
    this._hintDismissedAtKg.set(null);
    this.storage.remove(KEY_WEIGHT);
    this.storage.remove(KEY_HINT);
  }

  private persist(): boolean {
    return this.storage.set(KEY_WEIGHT, this._entries());
  }
}
