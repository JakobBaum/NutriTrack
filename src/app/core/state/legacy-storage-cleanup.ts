import { StorageService } from '../storage/storage.service';

/** Früherer Speicherschlüssel (ohne Präfix) der Rezeptsuche mit eigenem Spoonacular-Key; die Funktion ist entfallen. */
export const LEGACY_RECIPE_SEARCH_KEY = 'recipe-search-config';

/**
 * Löscht beim App-Start einen alten Eintrag der Rezeptsuche-Konfiguration (eigener Key, Basis-URL),
 * damit kein Schlüssel auf dem Gerät zurückbleibt. Ohne Eintrag passiert nichts; der StorageService
 * ergänzt das Präfix und protokolliert Fehler beim Entfernen.
 */
export function removeLegacyRecipeSearchConfig(storage: Pick<StorageService, 'remove'>): void {
  storage.remove(LEGACY_RECIPE_SEARCH_KEY);
}
