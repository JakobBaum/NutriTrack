import { HttpClient, HttpParams, HttpResponse } from '@angular/common/http';
import { Injectable, inject, signal } from '@angular/core';
import { firstValueFrom, timeout } from 'rxjs';
import { AI_TIMEOUT_MS } from '../../ai/ai-errors';
import { ConsentService } from '../../consent/consent.service';
import { RecipeSearchAccessService } from './recipe-search-access';
import { OnlineRecipe, OnlineSearchPage } from './online-recipe.model';
import { OnlineSearchError, ONLINE_SEARCH_MESSAGES, toOnlineSearchError } from './spoonacular.errors';
import { mapSpoonRecipe } from './spoonacular.mapper';
import {
  DEFAULT_PAGE_SIZE,
  OnlineSearchFilters,
  buildSearchParams,
  parseQuotaLeft,
} from './spoonacular.query';
import { SpoonSearchResponse } from './spoonacular.types';

const SEARCH_PATH = '/recipes/complexSearch';
const QUOTA_HEADER = 'X-Api-Quota-Left';

/**
 * Online-Rezeptdatenbank **spoonacular** (GET complexSearch) ausschließlich über die globale Worker-Route;
 * der Schlüssel liegt serverseitig, im Client gibt es keinen.
 */
@Injectable({ providedIn: 'root' })
export class SpoonacularProvider {
  private readonly http = inject(HttpClient);
  private readonly accessService = inject(RecipeSearchAccessService);
  private readonly consent = inject(ConsentService);

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

  private async get(params: Record<string, string>): Promise<HttpResponse<SpoonSearchResponse>> {
    const access = this.accessService.resolve();
    if (!access.available) throw new OnlineSearchError('no-key', ONLINE_SEARCH_MESSAGES['no-key']);
    if (!this.consent.isGranted() && !(await this.consent.ensure())) throw new OnlineSearchError('consent', ONLINE_SEARCH_MESSAGES.consent);
    try {
      const res = await firstValueFrom(
        this.http.get<SpoonSearchResponse>(`${access.baseUrl}${SEARCH_PATH}`, {
          params: new HttpParams({ fromObject: params }),
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
