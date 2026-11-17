import { WritableSignal } from '@angular/core';

/**
 * Setzt den neuen Stand und speichert ihn; scheitert das Speichern (z. B. Schreibsperre oder ungesicherter
 * Schlüssel), wird der vorherige Stand wiederhergestellt, damit die Oberfläche nichts zeigt, das nie gespeichert wird.
 * @returns `true`, wenn der neue Stand gespeichert wurde.
 */
export function commitSignal<T>(target: WritableSignal<T>, next: T, persist: () => boolean): boolean {
  const previous = target();
  target.set(next);
  if (persist()) return true;
  target.set(previous);
  return false;
}
