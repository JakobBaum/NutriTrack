import { HttpClient, HttpParams, HttpResponse } from '@angular/common/http';
import { Injectable, inject, signal } from '@angular/core';
import { firstValueFrom, timeout } from 'rxjs';
import { AI_TIMEOUT_MS } from '../../ai/ai-errors';
import { RecipeSearchConfig } from '../../state/recipe-search-config.store';
import { RecipeSearchAccessService } from './recipe-search-access';
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
 * Online-Rezeptdatenbank **spoonacular** (GET complexSearch). Mit eigenem Schlüssel direkt gegen
 * spoonacular (Header `x-api-key`), sonst über die globale Worker-Route ohne Schlüssel im Client.
 * Der Key wird nie geloggt; bei Worker-Fehlern gibt es keinen Rückfall auf einen fehlenden Key.
 */
@Injectable({ providedIn: 'root' })
export class SpoonacularProvider {
  private readonly http = inject(HttpClient);
  private readonly accessService = inject(RecipeSearchAccessService);

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
    const access = this.accessService.resolve(override);
    if (access.mode === 'none') throw new OnlineSearchError('no-key', ONLINE_SEARCH_MESSAGES['no-key']);
    try {
      const res = await firstValueFrom(
        this.http.get<SpoonSearchResponse>(`${access.baseUrl}${SEARCH_PATH}`, {
          params: new HttpParams({ fromObject: params }),
          headers: access.mode === 'ownKey' ? { 'x-api-key': access.apiKey } : {},
          observe: 'response',
        }).pipe(timeout(AI_TIMEOUT_MS)),
      );
      const quota = parseQuotaLeft(res.headers.get(QUOTA_HEADER));
      if (quota !== null) this._quotaLeft.set(quota);
      return res;
    } catch (e: unknown) {
      throw toOnlineSearchError(e, typeof navigator !== 'undefined' && navigator.onLine === false);
    }
  }
}
