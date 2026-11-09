/** Schließt die Bildschirmtastatur, indem das fokussierte Feld verlassen wird ("Fertig" per Eingabetaste). */
export function dismissKeyboard(doc: Document = document): void {
  const active = doc.activeElement;
  if (active instanceof HTMLElement) active.blur();
}
