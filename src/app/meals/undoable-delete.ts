import { signal } from '@angular/core';

/**
 * Verzögertes Löschen mit „Rückgängig“: Der Eintrag wird sofort ausgeblendet
 * (`pendingId`), aber erst endgültig entfernt (`commit`), wenn der Hinweis
 * ohne Rückgängig endet. So bleiben ID und Verweise (z. B. Tagebuch) erhalten.
 */
export class UndoableDelete {
  private readonly _pendingId = signal<string | null>(null);
  readonly pendingId = this._pendingId.asReadonly();

  constructor(private readonly commit: (id: string) => void) {}

  /** Blendet den Eintrag aus; ein noch offenes früheres Löschen wird zuerst endgültig. */
  start(id: string): void {
    this.flush();
    this._pendingId.set(id);
  }

  /** Stellt den ausgeblendeten Eintrag wieder her. */
  undo(): void {
    this._pendingId.set(null);
  }

  /** Entfernt den ausgeblendeten Eintrag endgültig. */
  flush(): void {
    const id = this._pendingId();
    if (id === null) return;
    this._pendingId.set(null);
    this.commit(id);
  }
}

const UNDO_ROLE = 'undo';

/** Dauer des „Gelöscht“-Hinweises in ms. */
export const UNDO_TOAST_MS = 5000;

/** Toast-Button „Rückgängig“. */
export const UNDO_TOAST_BUTTONS = [{ text: 'Rückgängig', role: UNDO_ROLE }];

/** Schließt den Hinweis ab: Rückgängig stellt wieder her, sonst wird endgültig gelöscht. */
export function settleUndoToast(del: UndoableDelete, role: string | undefined): void {
  if (role === UNDO_ROLE) del.undo();
  else del.flush();
}
