import { signal } from '@angular/core';
import { FoodItem } from '../core/models';
import { foodErrorMessage } from '../core/food/food-errors';

export const SEARCH_DEBOUNCE_MS = 400;
/** Kürzere Suchbegriffe liefern nur Rauschen. */
const MIN_SEARCH_CHARS = 2;

/** Minimale Schnittstelle des Food-Providers, die die Suche braucht. */
export interface FoodTextSearch {
  searchByText(query: string): Promise<FoodItem[]>;
}

/** Zustand und Ablauf der Lebensmittel-Textsuche im Add-Modal. */
export class DiarySearch {
  query = '';
  readonly results = signal<FoodItem[]>([]);
  readonly searching = signal(false);
  readonly hint = signal<string | null>(null);
  /** True, wenn die letzte Suche keinen Treffer hatte (zeigt „Manuell eintragen“). */
  readonly noResults = signal(false);
  readonly debounceMs = SEARCH_DEBOUNCE_MS;
  /** Suchbegriff, zu dem die aktuellen Treffer gehören. */
  private resultsQuery = '';
  private seq = 0;

  constructor(
    private readonly food: FoodTextSearch,
    /** Meldet bzw. löscht (null) einen Suchfehler im Seitenzustand. */
    private readonly setError: (message: string | null) => void,
  ) {}

  /** Setzt Suchfeld, Treffer und Hinweise zurück. */
  reset(): void {
    this.query = '';
    this.results.set([]);
    this.resultsQuery = '';
    this.hint.set(null);
    this.noResults.set(false);
  }

  /** Leert Eingabe und Treffer nach der Auswahl. */
  clearAfterPick(): void {
    this.results.set([]);
    this.query = '';
  }

  onInput(value: unknown): void {
    this.query = typeof value === 'string' ? value : '';
    const length = this.query.trim().length;
    if (length < MIN_SEARCH_CHARS) {
      this.seq += 1;
      this.results.set([]);
      this.noResults.set(false);
      this.hint.set(length === 0 ? null : `Gib mindestens ${MIN_SEARCH_CHARS} Zeichen ein.`);
      this.searching.set(false);
      return;
    }
    void this.run();
  }

  /** Enter im Suchfeld: erster Treffer zum aktuellen Begriff (sucht bei Bedarf zuerst); null ohne Treffer. */
  async pickFirst(): Promise<FoodItem | null> {
    const q = this.query.trim();
    if (this.searching() || this.resultsQuery !== q) await this.run();
    if (this.resultsQuery !== q) return null;
    return this.results()[0] ?? null;
  }

  async run(): Promise<void> {
    const q = this.query.trim();
    if (q.length < MIN_SEARCH_CHARS) return;
    const seq = ++this.seq;
    this.setError(null);
    this.hint.set(null);
    this.noResults.set(false);
    this.searching.set(true);
    try {
      const results = await this.food.searchByText(q);
      if (seq !== this.seq) return;
      this.results.set(results);
      this.resultsQuery = q;
      if (results.length === 0) {
        this.hint.set(`Keine Treffer für „${q}“ — prüfe die Schreibweise.`);
        this.noResults.set(true);
      }
    } catch (e: unknown) {
      if (seq === this.seq) this.setError(foodErrorMessage(e));
    } finally {
      if (seq === this.seq) this.searching.set(false);
    }
  }
}
