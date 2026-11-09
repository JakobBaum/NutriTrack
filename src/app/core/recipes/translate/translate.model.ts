import { AppLanguage } from '../../state/app-settings.store';

/** Die übersetzbaren Texte eines Rezepts (Mengen und Einheiten bleiben unberührt). */
export interface RecipeTexts {
  title: string;
  /** Zutatennamen in Rezept-Reihenfolge. */
  ingredients: string[];
  steps: string[];
}

/** Ergebnis einer Übersetzung; `complete` = Titel, Zutaten und Schritte wurden von der KI übersetzt. */
export interface TranslationResult {
  texts: RecipeTexts;
  complete: boolean;
}

export type TranslateLanguage = AppLanguage;
