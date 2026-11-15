import { signal } from '@angular/core';
import { PriceInfo } from '../../core/price/open-prices.provider';
import { formatNum } from '../../shared/num.pipe';

/**
 * Hinweistext des Formulars mit Sequenz-Token für asynchrone Preisanfragen: nur die jüngste Anfrage darf
 * ihr Ergebnis anzeigen. Jedes `set` (neuer Treffer, Formular zurückgesetzt) verwirft laufende Anfragen.
 */
export class PriceHint {
  readonly text = signal<string | null>(null);
  private seq = 0;

  /** Setzt den Hinweis und macht alle ausgegebenen Token ungültig. */
  set(text: string | null): void {
    this.seq++;
    this.text.set(text);
  }

  /** Startet eine Anfrage und liefert ihr Token. */
  begin(): number {
    return ++this.seq;
  }

  /** Setzt den Hinweis nur, wenn das Token noch das jüngste ist; sagt, ob es gesetzt wurde. */
  setIfCurrent(token: number, text: string): boolean {
    if (token !== this.seq) return false;
    this.text.set(text);
    return true;
  }
}

/** Hinweistext zu einem realen Preis (Open Prices). */
export function priceHintText(price: PriceInfo): string {
  return `Realer Preis ca. ${formatNum(price.avg, 2, 2)} ${price.currency}.`;
}
