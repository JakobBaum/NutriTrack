import { computed, signal } from '@angular/core';

/**
 * Verzögertes Löschen mit „Rückgängig“: Der Eintrag wird sofort ausgeblendet
 * (`pendingId`), aber erst endgültig entfernt (`commit`), wenn der Hinweis
 * ohne Rückgängig endet. So bleiben ID und Verweise (z. B. Tagebuch) erhalten.
 *
 * Standard: ein offenes Löschen; ein neues macht das frühere endgültig. Mit `stack` bleiben mehrere
 * Löschungen vorgemerkt, damit ein früheres Rückgängig nicht still verfällt (Rückgängig stellt alle her).
 */
export class UndoableDelete {
  private readonly _pendingIds = signal<readonly string[]>([]);
  /** Alle ausgeblendeten IDs (ohne `stack` höchstens eine). */
  readonly pendingIds = this._pendingIds.asReadonly();
  /** Zuletzt ausgeblendete ID oder null. */
  readonly pendingId = computed(() => this._pendingIds().at(-1) ?? null);

  private readonly _seq = signal(0);
  /** Zählt jedes Löschen; als `@for`-Schlüssel baut es den Hinweis neu auf (Laufzeit und Text beginnen von vorn). */
  readonly seq = this._seq.asReadonly();
  /** Anzahl der ausgeblendeten Einträge (für „n … gelöscht“). */
  readonly count = computed(() => this._pendingIds().length);

  constructor(
    private readonly commit: (id: string) => void,
    private readonly options: { readonly stack?: boolean } = {},
  ) {}

  /** Blendet den Eintrag aus; ohne `stack` wird ein noch offenes früheres Löschen zuerst endgültig. Doppelte IDs zählen einmal. */
  start(id: string): void {
    if (!this.options.stack) this.flush();
    this._pendingIds.update((ids) => (ids.includes(id) ? ids : [...ids, id]));
    this._seq.update((n) => n + 1);
  }

  /** Stellt die ausgeblendeten Einträge wieder her. */
  undo(): void {
    this._pendingIds.set([]);
  }

  /** Entfernt die ausgeblendeten Einträge endgültig. */
  flush(): void {
    const ids = this._pendingIds();
    if (ids.length === 0) return;
    this._pendingIds.set([]);
    ids.forEach((id) => this.commit(id));
  }
}

/** Hinweistext: „Rezept gelöscht“ bzw. „3 Rezepte gelöscht“. */
export function undoDeleteMessage(count: number, one: string, many: string): string {
  return count > 1 ? `${count} ${many} gelöscht` : `${one} gelöscht`;
}

const UNDO_ROLE = 'undo';

/** Dauer des „Gelöscht“-Hinweises in ms. */
export const UNDO_TOAST_MS = 3500;

/** Toast-Button „Rückgängig“. */
export const UNDO_TOAST_BUTTONS = [{ text: 'Rückgängig', role: UNDO_ROLE }];

/** Schließt den Hinweis ab: Rückgängig stellt wieder her, sonst wird endgültig gelöscht. */
export function settleUndoToast(del: UndoableDelete, role: string | undefined): void {
  if (role === UNDO_ROLE) del.undo();
  else del.flush();
}
