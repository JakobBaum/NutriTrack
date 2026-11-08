import { Injectable, inject, signal } from '@angular/core';
import { StorageService } from '../storage/storage.service';

/** Storage-Key; wird beim Backup-Export von Secrets bereinigt (siehe backup.ts). */
export const RECIPE_SEARCH_KEY = 'recipe-search-config';
export const DEFAULT_RECIPE_SEARCH_BASE_URL = 'https://api.spoonacular.com';

/** Zugang zur Online-Rezeptsuche. `baseUrl` ist austauschbar (später Worker-Route mit Server-Key). */
export interface RecipeSearchConfig {
  apiKey: string;
  baseUrl: string;
}

const DEFAULT_CONFIG: RecipeSearchConfig = { apiKey: '', baseUrl: DEFAULT_RECIPE_SEARCH_BASE_URL };

/** Hält die lokal gespeicherte Konfiguration der Rezept-Suche. Der Key wird nie geloggt. */
@Injectable({ providedIn: 'root' })
export class RecipeSearchConfigStore {
  private readonly storage = inject(StorageService);
  private readonly _config = signal<RecipeSearchConfig>(this.load());

  readonly config = this._config.asReadonly();

  hasKey(): boolean {
    return this._config().apiKey.trim().length > 0;
  }

  setApiKey(apiKey: string): void {
    this.save({ ...this._config(), apiKey: apiKey.trim() });
  }

  clear(): void {
    this._config.set(DEFAULT_CONFIG);
    this.storage.remove(RECIPE_SEARCH_KEY);
  }

  private save(config: RecipeSearchConfig): void {
    this._config.set(config);
    this.storage.set(RECIPE_SEARCH_KEY, config);
  }

  private load(): RecipeSearchConfig {
    const stored = this.storage.get<Partial<RecipeSearchConfig>>(RECIPE_SEARCH_KEY, {});
    return {
      apiKey: typeof stored.apiKey === 'string' ? stored.apiKey : '',
      baseUrl: typeof stored.baseUrl === 'string' && stored.baseUrl.trim() ? stored.baseUrl.trim() : DEFAULT_RECIPE_SEARCH_BASE_URL,
    };
  }
}
