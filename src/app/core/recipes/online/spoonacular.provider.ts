import { HttpClient, HttpParams, HttpResponse } from '@angular/common/http';
import { Injectable, inject, signal } from '@angular/core';
import { firstValueFrom } from 'rxjs';
import { RecipeSearchConfig, RecipeSearchConfigStore } from '../../state/recipe-search-config.store';
import { OnlineRecipe, OnlineSearchPage } from './online-recipe.model';
import { OnlineSearchError, ONLINE_SEARCH_MESSAGES, toOnlineSearchError } from './spoonacular.errors';
import { mapSpoonRecipe } from './spoonacular.mapper';
import {
  DEFAULT_PAGE_SIZE,
  EMPTY_FILTERS,
  OnlineSearchFilters,
  buildSearchParams,
  parseQuotaLeft,
} from './spoonacular.query';
import { SpoonSearchResponse } from './spoonacular.types';

const SEARCH_PATH = '/recipes/complexSearch';
const QUOTA_HEADER = 'X-Api-Quota-Left';

/**
 * Online-Rezeptdatenbank **spoonacular** (GET complexSearch, Auth per Header `x-api-key`).
 * Basis-URL und Key kommen aus {@link RecipeSearchConfigStore} und sind austauschbar
 * (geplant: Worker-Route mit serverseitigem Key). Der Key wird nie geloggt.
 */
@Injectable({ providedIn: 'root' })
export class SpoonacularProvider {
  private readonly http = inject(HttpClient);
  private readonly configStore = inject(RecipeSearchConfigStore);

  private readonly _quotaLeft = signal<number | null>(null);
  /** Zuletzt gemeldete Restpunkte des Tages (null = unbekannt). */
  readonly quotaLeft = this._quotaLeft.asReadonly();

  /** Sucht Rezepte inkl. Nährwerten, Zutaten und Anleitung. */
  async search(filters: OnlineSearchFilters, offset = 0, number = DEFAULT_PAGE_SIZE): Promise<OnlineSearchPage> {
    const res = await this.get(buildSearchParams(filters, offset, number));
    const recipes = (res.body?.results ?? [])
      .map(mapSpoonRecipe)
      .filter((r): r is OnlineRecipe => r !== null);
    return { recipes, totalResults: res.body?.totalResults ?? recipes.length, quotaLeft: this._quotaLeft() };
  }

  /** Günstigste Anfrage (1 Treffer, keine Zusatzdaten) zum Prüfen von Key und Verbindung. */
  async ping(configOverride?: Partial<RecipeSearchConfig>): Promise<number | null> {
    await this.get(buildSearchParams(EMPTY_FILTERS, 0, 1, false), configOverride);
    return this._quotaLeft();
  }

  private async get(
    params: Record<string, string>,
    override?: Partial<RecipeSearchConfig>,
  ): Promise<HttpResponse<SpoonSearchResponse>> {
    const cfg = { ...this.configStore.config(), ...override };
    const apiKey = cfg.apiKey.trim();
    if (!apiKey) throw new OnlineSearchError('no-key', ONLINE_SEARCH_MESSAGES['no-key']);
    const base = cfg.baseUrl.replace(/\/+$/, '');
    try {
      const res = await firstValueFrom(
        this.http.get<SpoonSearchResponse>(`${base}${SEARCH_PATH}`, {
          params: new HttpParams({ fromObject: params }),
          headers: { 'x-api-key': apiKey },
          observe: 'response',
        }),
      );
      const quota = parseQuotaLeft(res.headers.get(QUOTA_HEADER));
      if (quota !== null) this._quotaLeft.set(quota);
      return res;
    } catch (e: unknown) {
      throw toOnlineSearchError(e, typeof navigator !== 'undefined' && navigator.onLine === false);
    }
  }
}
