import { HttpClient, HttpErrorResponse, HttpHeaders } from '@angular/common/http';
import { Injectable, inject } from '@angular/core';
import { firstValueFrom } from 'rxjs';
import { FoodItem, NutritionFacts } from '../models';
import { makeId } from '../util/id';
import { FoodProvider } from './food-provider';
import { SettingsStore } from '../state/settings.store';
import { environment } from '../../../environments/environment';
import { DebugLogService } from '../debug/debug-log.service';

// Freitextsuche: dev → proxied relative path; prod → direkt (CapacitorHttp bypasses CORS).
// Wenn proxyUrl gesetzt: ${proxyUrl}/off-search (CF-Worker übernimmt den CORS-Proxy).
const SEARCH_URL_DEFAULT = environment.offSearchUrl;
// Barcode exakt über Product Opener v3 (hat CORS *).
const PRODUCT_V3_URL = 'https://world.openfoodfacts.org/api/v3/product';
const FIELDS = 'code,product_name,brands,image_url,image_small_url,nutriments,serving_quantity';
const LANGS = 'de,en';

const OFF_HEADERS = new HttpHeaders({
  'User-Agent': 'NutriTrack/1.0 (https://github.com/jakob/nutritrack)',
});

interface OffNutriments {
  [k: string]: number | string | undefined;
}
interface OffProduct {
  code?: string;
  product_name?: string;
  brands?: string | string[];
  image_url?: string;
  image_small_url?: string;
  serving_quantity?: number | string;
  nutriments?: OffNutriments;
}
interface SearchResponse {
  hits?: OffProduct[];
  count?: number;
}
interface ProductV3Response {
  status?: string;
  product?: OffProduct;
}

/** Ein nicht gefundener Treffer (HTTP 404) ist kein Netzwerkfehler. */
function isNotFound(e: unknown): boolean {
  return e instanceof HttpErrorResponse && e.status === 404;
}

/**
 * Food-Datenquelle über die freie **OpenFoodFacts**-API (kein Key nötig).
 * Freitextsuche via **search-a-licious** (`/search`), Barcode-Lookup via
 * **Product Opener v3**. not-found (404) → leer/null statt Netzfehler.
 */
@Injectable({ providedIn: 'root' })
export class OpenFoodFactsProvider implements FoodProvider {
  private readonly http = inject(HttpClient);
  private readonly settings = inject(SettingsStore);
  private readonly log = inject(DebugLogService);

  private searchUrl(): string {
    const proxy = this.settings.ai().proxyUrl?.trim();
    return proxy ? `${proxy.replace(/\/$/, '')}/off-search` : SEARCH_URL_DEFAULT;
  }

  async searchByText(query: string, limit = 12): Promise<FoodItem[]> {
    const q = query.trim();
    if (!q) return [];
    const url = this.searchUrl();
    this.log.info(`→ Suche "${q}" via ${url}`);
    try {
      const res = await firstValueFrom(
        this.http.get<SearchResponse>(url, {
          headers: OFF_HEADERS,
          params: {
            q,
            page_size: String(limit),
            fields: FIELDS,
            langs: LANGS,
          },
        }),
      );
      const items = (res.hits ?? [])
        .map((p) => this.toFoodItem(p))
        .filter((f): f is FoodItem => f !== null);
      this.log.success(`✓ ${items.length} Treffer für "${q}"`);
      return items;
    } catch (e: unknown) {
      if (isNotFound(e)) { this.log.info(`Keine Treffer für "${q}"`); return []; }
      const msg = e instanceof HttpErrorResponse
        ? `HTTP ${e.status}: ${e.message}`
        : (e instanceof Error ? e.message : String(e));
      this.log.error(`✗ Suche "${q}": ${msg}`);
      throw e;
    }
  }

  /** Produkt-Namensvorschläge für die Freitextsuche (kleine, schnelle Trefferliste). */
  async autocomplete(query: string, limit = 6): Promise<FoodItem[]> {
    return this.searchByText(query, limit);
  }

  async lookupByBarcode(barcode: string): Promise<FoodItem | null> {
    const code = barcode.trim();
    if (!code) return null;
    try {
      const res = await firstValueFrom(
        this.http.get<ProductV3Response>(
          `${PRODUCT_V3_URL}/${encodeURIComponent(code)}.json`,
          { headers: OFF_HEADERS, params: { fields: FIELDS } },
        ),
      );
      if (!res.product || res.status === 'failure') return null;
      return this.toFoodItem(res.product);
    } catch (e: unknown) {
      if (isNotFound(e)) return null;
      throw e;
    }
  }

  private num(v: number | string | undefined): number {
    const n = typeof v === 'number' ? v : Number(v);
    return Number.isFinite(n) ? Math.max(0, n) : 0;
  }

  private toFoodItem(p: OffProduct): FoodItem | null {
    const name = (p.product_name ?? '').trim();
    if (!name) return null;
    const n = p.nutriments ?? {};
    const facts: NutritionFacts = {
      kcal: this.num(n['energy-kcal_100g']),
      proteinG: this.num(n['proteins_100g']),
      carbsG: this.num(n['carbohydrates_100g']),
      fatG: this.num(n['fat_100g']),
      fiberG: this.num(n['fiber_100g']),
      sugarG: this.num(n['sugars_100g']),
      saltG: this.num(n['salt_100g']),
      basis: 'per100g',
    };
    return {
      id: makeId('off'),
      source: 'openfoodfacts',
      name,
      brand: Array.isArray(p.brands) ? p.brands[0] : p.brands?.split(',')[0]?.trim(),
      barcode: p.code,
      facts,
      servingG: p.serving_quantity ? this.num(p.serving_quantity) : undefined,
      imageUrl: p.image_small_url || p.image_url,
    };
  }
}
